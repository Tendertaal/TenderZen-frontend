"""
Tender business logic - with team assignments support
TenderZen v2.3 - Smart Import Support

CHANGELOG:
- v1.0: Initial version
- v2.0: Multi-tenancy fix - filter op tenderbureau_id
- v2.1: Bedrijfsvelden verwijderd uit tenders (nu via bedrijf_id JOIN)
- v2.2: Fix Decimal serialization for JSON (geraamde_waarde, minimale_omzet, etc.)
- v2.3: smart_import_id en ai_model_used toegevoegd aan SELECT queries
"""
from typing import List, Optional
from decimal import Decimal
from supabase import Client
from app.models.tender import TenderCreate, TenderUpdate


# ============================================
# VELDEN DIE NIET MEER IN TENDERS TABEL ZITTEN
# Deze worden uitgefilterd bij create/update
# ============================================
REMOVED_TENDER_FIELDS = {
    'bedrijfsnaam',
    'kvk_nummer', 
    'btw_nummer',
    'contactpersoon',
    'contact_email',
    'contact_telefoon',
    'bedrijfs_adres',
    'bedrijfs_postcode',
    'bedrijfs_plaats'
}


class TenderService:
    """Service for tender operations"""
    
    def __init__(self, db: Client):
        self.db = db
    
    def _serialize_data(self, data: dict) -> dict:
        """Convert date objects and Decimal to JSON-serializable types"""
        serialized = {}
        for key, value in data.items():
            if value is None:
                serialized[key] = None
            elif hasattr(value, 'isoformat'):  # date/datetime objects
                serialized[key] = value.isoformat()
            elif isinstance(value, Decimal):  # Decimal -> float
                serialized[key] = float(value)
            else:
                serialized[key] = value
        return serialized
    
    def _filter_removed_fields(self, data: dict) -> dict:
        """
        Filter out fields that have been removed from the tenders table.
        These fields now live in the bedrijven table (accessed via bedrijf_id).
        """
        filtered = {k: v for k, v in data.items() if k not in REMOVED_TENDER_FIELDS}
        
        # Log if we filtered anything
        removed = set(data.keys()) & REMOVED_TENDER_FIELDS
        if removed:
            print(f"ℹ️ Filtered removed bedrijf fields: {removed}")
        
        return filtered
    
    def _extract_team_assignments(self, data: dict) -> Optional[List[dict]]:
        """Extract team_assignments from data and remove from dict"""
        team_assignments = data.pop('team_assignments', None)
        return team_assignments
    
    async def _get_user_tenderbureau_id(self, user_id: str) -> Optional[str]:
        """
        Get the tenderbureau_id for a user.
        First checks user_bureau_access, then falls back to users table.
        """
        try:
            # Try user_bureau_access first (for multi-bureau support)
            # Get the most recently accessed bureau
            result = self.db.table('user_bureau_access')\
                .select('tenderbureau_id')\
                .eq('user_id', user_id)\
                .eq('is_active', True)\
                .order('last_accessed_at', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['tenderbureau_id']
            
            # Fallback to users table
            result = self.db.table('users')\
                .select('tenderbureau_id')\
                .eq('id', user_id)\
                .single()\
                .execute()
            
            if result.data:
                return result.data.get('tenderbureau_id')
            
            return None
            
        except Exception as e:
            print(f"⚠️ Error getting user tenderbureau_id: {e}")
            return None
    
    async def _is_super_admin(self, user_id: str) -> bool:
        """Check if user is super admin"""
        try:
            result = self.db.table('users')\
                .select('is_super_admin')\
                .eq('id', user_id)\
                .single()\
                .execute()
            
            return result.data.get('is_super_admin', False) if result.data else False
        except Exception:
            return False
    
    async def _save_team_assignments(self, tender_id: str, team_assignments: List[dict]) -> None:
        """
        Save team assignments to tender_team_assignments table.
        Replaces all existing assignments for this tender.
        """
        if team_assignments is None:
            return
        
        try:
            # First, delete existing assignments for this tender
            self.db.table('tender_team_assignments')\
                .delete()\
                .eq('tender_id', tender_id)\
                .execute()
            
            print(f"🗑️ Deleted existing team assignments for tender {tender_id}")
            
            # Insert new assignments
            if team_assignments and len(team_assignments) > 0:
                assignments_to_insert = []
                
                for assignment in team_assignments:
                    # Map frontend data to database columns
                    if assignment.get('team_member_id'):
                        assignments_to_insert.append({
                            'tender_id': tender_id,
                            'team_member_id': assignment.get('team_member_id'),
                            'rol_in_tender': assignment.get('rol', ''),
                            'geplande_uren': assignment.get('uren', 0),
                            'werkelijke_uren': 0  # Default to 0
                        })
                
                if assignments_to_insert:
                    self.db.table('tender_team_assignments')\
                        .insert(assignments_to_insert)\
                        .execute()
                    
                    print(f"✅ Saved {len(assignments_to_insert)} team assignments for tender {tender_id}")
            
        except Exception as e:
            print(f"❌ Error saving team assignments: {e}")
            # Don't raise - we don't want to fail the whole tender save
    
    async def _get_team_assignments(self, tender_id: str) -> List[dict]:
        """Get team assignments for a tender"""
        try:
            result = self.db.table('tender_team_assignments')\
                .select('*, team_members(naam, rol, initialen)')\
                .eq('tender_id', tender_id)\
                .execute()
            
            # Transform to frontend format
            assignments = []
            for row in result.data:
                team_member = row.get('team_members', {}) or {}
                assignments.append({
                    'id': row.get('id'),
                    'team_member_id': row.get('team_member_id'),
                    'naam': team_member.get('naam', ''),
                    'rol': row.get('rol_in_tender', ''),
                    'uren': row.get('geplande_uren', 0),
                    'werkelijke_uren': row.get('werkelijke_uren', 0)
                })
            
            return assignments
            
        except Exception as e:
            print(f"❌ Error getting team assignments: {e}")
            return []
    
    async def get_all_tenders(self, user_id: str, tenderbureau_id: Optional[str] = None) -> List[dict]:
        """
        Get all tenders for a user's tenderbureau.
        
        MULTI-TENANCY FIX:
        - Nu filtert op tenderbureau_id zodat collega's elkaars tenders kunnen zien
        - Super-admins kunnen optioneel alle bureaus zien
        
        v2.1: Nu met JOIN naar bedrijven tabel voor bedrijfsgegevens
        v2.3: smart_import_id en ai_model_used toegevoegd
        
        Args:
            user_id: UUID van de ingelogde user
            tenderbureau_id: Optioneel - specifiek bureau (voor super-admins)
        
        Returns:
            List van tenders binnen het tenderbureau
        """
        try:
            # Bepaal het tenderbureau
            if tenderbureau_id:
                # Expliciet meegegeven (bijv. door super-admin)
                bureau_id = tenderbureau_id
            else:
                # Haal op van de user
                bureau_id = await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                print(f"⚠️ No tenderbureau found for user {user_id}")
                return []
            
            # v2.3: smart_import_id en ai_model_used expliciet toegevoegd
            result = self.db.table('tenders')\
                .select('*, smart_import_id, ai_model_used, tenderbureaus(naam), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .eq('tenderbureau_id', bureau_id)\
                .order('created_at', desc=True)\
                .execute()
            
            print(f"✅ Found {len(result.data)} tenders for bureau {bureau_id}")
            
            # Add team_assignments and flatten bedrijf data
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                # Flatten bedrijf data for backward compatibility
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenders.append(tender)
            
            return tenders
            
        except Exception as e:
            print(f"❌ Error getting tenders: {e}")
            raise
    
    async def get_all_tenders_all_bureaus(self, user_id: str) -> List[dict]:
        """
        Get all tenders across all bureaus (super-admin only).
        v2.3: smart_import_id en ai_model_used toegevoegd
        """
        try:
            # Check if super admin
            is_super = await self._is_super_admin(user_id)
            if not is_super:
                print(f"⚠️ User {user_id} is not super admin")
                return []
            
            # v2.3: smart_import_id en ai_model_used expliciet toegevoegd
            result = self.db.table('tenders')\
                .select('*, smart_import_id, ai_model_used, tenderbureaus(naam), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .order('created_at', desc=True)\
                .execute()
            
            print(f"✅ Found {len(result.data)} tenders across all bureaus")
            
            # Add team_assignments and flatten bedrijf data
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                # Flatten bedrijf data
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenders.append(tender)
            
            return tenders
            
        except Exception as e:
            print(f"❌ Error getting all tenders: {e}")
            raise
    
    async def get_tender_by_id(self, tender_id: str, user_id: str) -> Optional[dict]:
        """
        Get a single tender by ID.
        
        MULTI-TENANCY:
        - User moet in hetzelfde tenderbureau zitten als de tender
        - Of super-admin zijn
        
        v2.3: smart_import_id en ai_model_used toegevoegd
        """
        try:
            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)
            
            # v2.3: smart_import_id en ai_model_used expliciet toegevoegd
            query = self.db.table('tenders')\
                .select('*, smart_import_id, ai_model_used, tenderbureaus(naam), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .eq('id', tender_id)
            
            # Filter op bureau (tenzij super-admin)
            if not is_super and user_bureau_id:
                query = query.eq('tenderbureau_id', user_bureau_id)
            
            result = query.single().execute()
            
            if result.data:
                tender = result.data
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                # Flatten bedrijf data
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                return tender
            
            return None
            
        except Exception as e:
            print(f"❌ Error getting tender by ID: {e}")
            return None
    
    async def create_tender(
        self, 
        tender: TenderCreate, 
        user_id: str
    ) -> dict:
        """
        Create a new tender.
        
        MULTI-TENANCY:
        - tenderbureau_id wordt automatisch gezet op het bureau van de user
        - Tenzij expliciet meegegeven (super-admin)
        
        v2.1: Filtert bedrijfsvelden uit (die zitten nu in bedrijven tabel)
        """
        try:
            tender_data = tender.model_dump(exclude_unset=True)
            
            # ⭐ Filter removed bedrijf fields
            tender_data = self._filter_removed_fields(tender_data)
            
            # Set tenderbureau_id if not provided
            if not tender_data.get('tenderbureau_id'):
                bureau_id = await self._get_user_tenderbureau_id(user_id)
                if not bureau_id:
                    raise ValueError("User heeft geen tenderbureau")
                tender_data['tenderbureau_id'] = bureau_id
            
            # Extract team_assignments before serializing
            team_assignments = self._extract_team_assignments(tender_data)
            
            # Serialize dates and Decimals for JSON
            tender_data = self._serialize_data(tender_data)
            
            print(f"📝 Creating tender for bureau {tender_data.get('tenderbureau_id')}: {tender_data.get('naam')}")
            
            result = self.db.table('tenders')\
                .insert(tender_data)\
                .execute()
            
            created_tender = result.data[0]
            print(f"✅ Tender created: {created_tender['id']}")
            
            # Save team assignments separately
            if team_assignments:
                await self._save_team_assignments(created_tender['id'], team_assignments)
            
            # Return tender with team_assignments
            created_tender['team_assignments'] = await self._get_team_assignments(created_tender['id'])
            
            return created_tender
            
        except Exception as e:
            print(f"❌ Error creating tender: {e}")
            raise
    
    async def update_tender(
        self, 
        tender_id: str, 
        tender: TenderUpdate, 
        user_id: str
    ) -> Optional[dict]:
        """
        Update a tender.
        
        MULTI-TENANCY:
        - User moet in hetzelfde tenderbureau zitten als de tender
        - Of super-admin zijn
        
        v2.1: Filtert bedrijfsvelden uit (die zitten nu in bedrijven tabel)
        v2.2: Fix Decimal serialization
        """
        try:
            tender_data = tender.model_dump(exclude_unset=True)
            
            # ⭐ Filter removed bedrijf fields
            tender_data = self._filter_removed_fields(tender_data)
            
            # Get user's bureau and check permissions
            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)
            
            # Extract team_assignments before serializing
            team_assignments = self._extract_team_assignments(tender_data)
            
            # Serialize dates and Decimals for JSON
            tender_data = self._serialize_data(tender_data)
            
            # Don't allow changing tenderbureau_id (unless super-admin)
            if not is_super:
                tender_data.pop('tenderbureau_id', None)
            
            print(f"📝 Updating tender {tender_id}")
            
            # Build update query
            if tender_data:
                query = self.db.table('tenders')\
                    .update(tender_data)\
                    .eq('id', tender_id)
                
                # Filter op bureau (tenzij super-admin)
                if not is_super and user_bureau_id:
                    query = query.eq('tenderbureau_id', user_bureau_id)
                
                result = query.execute()
                
                if not result.data:
                    return None
                
                updated_tender = result.data[0]
            else:
                # No tender data to update, just get current tender
                query = self.db.table('tenders')\
                    .select('*')\
                    .eq('id', tender_id)
                
                if not is_super and user_bureau_id:
                    query = query.eq('tenderbureau_id', user_bureau_id)
                
                result = query.execute()
                
                if not result.data:
                    return None
                
                updated_tender = result.data[0]
            
            # Save team assignments separately (if provided)
            if team_assignments is not None:
                await self._save_team_assignments(tender_id, team_assignments)
            
            # Return tender with team_assignments
            updated_tender['team_assignments'] = await self._get_team_assignments(tender_id)
            
            print(f"✅ Tender updated: {updated_tender['id']}")
            return updated_tender
            
        except Exception as e:
            print(f"❌ Error updating tender: {e}")
            raise
    
    async def delete_tender(self, tender_id: str, user_id: str) -> bool:
        """
        Delete a tender.
        
        MULTI-TENANCY:
        - User moet in hetzelfde tenderbureau zitten als de tender
        - Of super-admin zijn
        """
        try:
            # Get user's bureau and check permissions
            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)
            
            # Team assignments will be deleted automatically via CASCADE
            query = self.db.table('tenders')\
                .delete()\
                .eq('id', tender_id)
            
            # Filter op bureau (tenzij super-admin)
            if not is_super and user_bureau_id:
                query = query.eq('tenderbureau_id', user_bureau_id)
            
            result = query.execute()
            
            success = len(result.data) > 0
            if success:
                print(f"✅ Tender deleted: {tender_id}")
            else:
                print(f"⚠️ Tender not found or no permission: {tender_id}")
            
            return success
            
        except Exception as e:
            print(f"❌ Error deleting tender: {e}")
            raise
    
    async def get_tenders_by_fase(self, user_id: str, fase: str, tenderbureau_id: Optional[str] = None) -> List[dict]:
        """
        Get tenders by fase for user's tenderbureau.
        v2.3: smart_import_id en ai_model_used toegevoegd
        """
        try:
            # Bepaal het tenderbureau
            bureau_id = tenderbureau_id or await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                return []
            
            # v2.3: smart_import_id en ai_model_used expliciet toegevoegd
            result = self.db.table('tenders')\
                .select('*, smart_import_id, ai_model_used, tenderbureaus(naam), bedrijven(bedrijfsnaam, kvk_nummer, plaats)')\
                .eq('tenderbureau_id', bureau_id)\
                .eq('fase', fase)\
                .order('created_at', desc=True)\
                .execute()
            
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                # Flatten bedrijf data
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenders.append(tender)
            
            return tenders
            
        except Exception as e:
            print(f"❌ Error getting tenders by fase: {e}")
            raise
    
    async def get_tender_stats(self, user_id: str, tenderbureau_id: Optional[str] = None) -> dict:
        """
        Get tender statistics for a tenderbureau.
        """
        try:
            # Bepaal het tenderbureau
            bureau_id = tenderbureau_id or await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                return {'total': 0, 'by_fase': {}, 'by_status': {}}
            
            result = self.db.table('tenders')\
                .select('fase, status')\
                .eq('tenderbureau_id', bureau_id)\
                .execute()
            
            # Count by fase and status
            by_fase = {}
            by_status = {}
            
            for tender in result.data:
                fase = tender.get('fase', 'unknown')
                status = tender.get('status', 'unknown')
                
                by_fase[fase] = by_fase.get(fase, 0) + 1
                by_status[status] = by_status.get(status, 0) + 1
            
            return {
                'total': len(result.data),
                'by_fase': by_fase,
                'by_status': by_status
            }
            
        except Exception as e:
            print(f"❌ Error getting tender stats: {e}")
            return {'total': 0, 'by_fase': {}, 'by_status': {}}