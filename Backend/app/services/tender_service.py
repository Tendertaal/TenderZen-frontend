"""
Tender business logic - with team assignments support
TenderZen v2.3 - Milestone Enrichment voor Timeline

FIXES:
- Filter op tenderbureau_id ipv alleen created_by
- Collega's binnen hetzelfde bureau kunnen elkaars tenders zien
- Super-admins kunnen alle tenders zien

CHANGELOG:
- v1.0: Initial version
- v2.0: Multi-tenancy fix - filter op tenderbureau_id
- v2.1: Bedrijfsvelden verwijderd uit tenders (nu via bedrijf_id JOIN)
- v2.2: Fix Decimal serialization for JSON (geraamde_waarde, minimale_omzet, etc.)
- v2.3: Milestone enrichment — timeline-velden worden gevuld vanuit milestones tabel
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

# ============================================
# MILESTONE TYPE → TENDER VELD MAPPING
# Gebruikt om geëxtraheerde milestones terug
# te mappen naar de timeline-kolommen op tenders
# ============================================
MILESTONE_FIELD_MAP = {
    # milestone_type           → tender kolom
    'publicatie':               'publicatie_datum',
    'aankondiging':             'publicatie_datum',
    'schouw':                   'schouw_datum',
    'locatiebezoek':            'schouw_datum',
    'vragen_ronde_1':           'nvi1_datum',
    'nvi_1_deadline':           'nvi1_datum',
    'nota_inlichtingen_1':      'nvi1_datum',
    'nvi_1_publicatie':         'nvi1_datum',
    'vragen_ronde_2':           'nvi2_datum',
    'nvi_2_deadline':           'nvi2_datum',
    'nota_inlichtingen_2':      'nvi2_datum',
    'nvi_2_publicatie':         'nvi2_datum',
    'presentatie':              'presentatie_datum',
    'interview':                'presentatie_datum',
    'interne_deadline':         'interne_deadline',
    'sluitingsdatum':           'deadline_indiening',
    'deadline_indiening':       'deadline_indiening',
    'opening_inschrijving':     'deadline_indiening',
    'voorlopige_gunning':       'voorlopige_gunning',
    'definitieve_gunning':      'definitieve_gunning',
    'start_opdracht':           'start_uitvoering',
    'startdatum':               'start_uitvoering',
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
                    if assignment.get('team_member_id'):
                        assignments_to_insert.append({
                            'tender_id': tender_id,
                            'team_member_id': assignment.get('team_member_id'),
                            'rol_in_tender': assignment.get('rol', ''),
                            'geplande_uren': assignment.get('uren', 0),
                            'werkelijke_uren': 0
                        })
                
                if assignments_to_insert:
                    self.db.table('tender_team_assignments')\
                        .insert(assignments_to_insert)\
                        .execute()
                    
                    print(f"✅ Saved {len(assignments_to_insert)} team assignments for tender {tender_id}")
            
        except Exception as e:
            print(f"❌ Error saving team assignments: {e}")
    
    async def _get_team_assignments(self, tender_id: str) -> List[dict]:
        """Get team assignments for a tender"""
        try:
            result = self.db.table('tender_team_assignments')\
                .select('*')\
                .eq('tender_id', tender_id)\
                .execute()
            
            if not result.data:
                return []
            
            user_ids = [row['user_id'] for row in result.data if row.get('user_id')]
            
            if not user_ids:
                return []
            
            users_result = self.db.table('users')\
                .select('id, naam, initialen')\
                .in_('id', user_ids)\
                .execute()
            
            users_map = {u['id']: u for u in (users_result.data or [])}
            
            assignments = []
            for row in result.data:
                user_id = row.get('user_id')
                user = users_map.get(user_id, {})
                
                assignments.append({
                    'id': row.get('id'),
                    'user_id': user_id,
                    'naam': user.get('naam', ''),
                    'rol': row.get('rol_in_tender', ''),
                    'uren': row.get('geplande_uren', 0),
                    'werkelijke_uren': row.get('werkelijke_uren', 0)
                })
            
            return assignments
            
        except Exception as e:
            print(f"❌ Error getting team assignments: {e}")
            return []

    # ============================================
    # MILESTONE SYNC
    # ============================================

    async def sync_milestones_to_tender(self, tender_id: str) -> int:
        """
        Schrijft milestone-datums direct naar de corresponderende kolommen op de tenders tabel.
        Wordt aangeroepen na succesvolle AI-extractie.
        Returns: aantal bijgewerkte velden.
        """
        MILESTONE_TO_COLUMN = {
            'publicatie': 'publicatie_datum',
            'aankondiging': 'publicatie_datum',
            'schouw': 'schouw_datum',
            'locatiebezoek': 'schouw_datum',
            'vragen_ronde_1': 'nvi1_datum',
            'nvi_1_deadline': 'nvi1_datum',
            'nota_inlichtingen_1': 'nvi1_datum',
            'vragen_ronde_2': 'nvi2_datum',
            'nvi_2_deadline': 'nvi2_datum',
            'nota_inlichtingen_2': 'nvi2_datum',
            'presentatie': 'presentatie_datum',
            'interview': 'presentatie_datum',
            'interne_deadline': 'interne_deadline',
            'sluitingsdatum': 'deadline_indiening',
            'deadline_indiening': 'deadline_indiening',
            'voorlopige_gunning': 'voorlopige_gunning',
            'definitieve_gunning': 'definitieve_gunning',
            'start_opdracht': 'start_uitvoering',
            'startdatum': 'start_uitvoering',
        }

        try:
            result = self.db.table('milestones')\
                .select('milestone_type, datum, tijd')\
                .eq('tender_id', tender_id)\
                .execute()

            milestones = result.data or []
            if not milestones:
                return 0

            update_data = {}
            for m in milestones:
                if not m.get('datum'):
                    continue
                mt = (m.get('milestone_type') or '').lower()
                column = MILESTONE_TO_COLUMN.get(mt)
                if column and column not in update_data:
                    tijd = m.get('tijd')
                    if tijd:
                        update_data[column] = f"{m['datum']}T{tijd}"
                    else:
                        update_data[column] = f"{m['datum']}T00:00:00"

            if not update_data:
                return 0

            self.db.table('tenders')\
                .update(update_data)\
                .eq('id', tender_id)\
                .execute()

            print(f"📅 Synced {len(update_data)} milestone velden naar tender {tender_id}: {list(update_data.keys())}")
            return len(update_data)

        except Exception as e:
            print(f"⚠️ sync_milestones_to_tender fout: {e}")
            return 0

    # ============================================
    # GET ALL TENDERS
    # ============================================
    
    async def get_all_tenders(self, user_id: str, tenderbureau_id: Optional[str] = None) -> List[dict]:
        """
        Get all tenders for a user's tenderbureau.
        
        MULTI-TENANCY FIX:
        - Nu filtert op tenderbureau_id zodat collega's elkaars tenders kunnen zien
        - Super-admins kunnen optioneel alle bureaus zien
        
        v2.1: Nu met JOIN naar bedrijven tabel voor bedrijfsgegevens
        v2.3: Milestone enrichment — timeline-velden worden gevuld vanuit milestones
        """
        try:
            if tenderbureau_id:
                bureau_id = tenderbureau_id
            else:
                bureau_id = await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                print(f"⚠️ No tenderbureau found for user {user_id}")
                return []
            
            result = self.db.table('tenders')\
                .select('*, tenderbureaus(*), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .eq('tenderbureau_id', bureau_id)\
                .order('created_at', desc=True)\
                .execute()
            
            print(f"✅ Found {len(result.data)} tenders for bureau {bureau_id}")
            
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenderbureau = tender.pop('tenderbureaus', None) or {}
                tender['tenderbureau'] = tenderbureau
                
                tenders.append(tender)

            return tenders
            
        except Exception as e:
            print(f"❌ Error getting tenders: {e}")
            raise
    
    async def get_all_tenders_all_bureaus(self, user_id: str) -> List[dict]:
        """
        Get all tenders across all bureaus (super-admin only).
        v2.3: Milestone enrichment toegevoegd.
        """
        try:
            is_super = await self._is_super_admin(user_id)
            if not is_super:
                print(f"⚠️ User {user_id} is not super admin")
                return []
            
            result = self.db.table('tenders')\
                .select('*, tenderbureaus(*), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .order('created_at', desc=True)\
                .execute()
            
            print(f"✅ Found {len(result.data)} tenders across all bureaus")
            
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenderbureau = tender.pop('tenderbureaus', None) or {}
                tender['tenderbureau'] = tenderbureau
                
                tenders.append(tender)

            return tenders
            
        except Exception as e:
            print(f"❌ Error getting all tenders: {e}")
            raise
    
    async def get_tender_by_id(self, tender_id: str, user_id: str) -> Optional[dict]:
        """
        Get a single tender by ID.
        v2.3: Milestone enrichment toegevoegd.
        """
        try:
            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)
            
            query = self.db.table('tenders')\
                .select('*, tenderbureaus(*), bedrijven(bedrijfsnaam, kvk_nummer, btw_nummer, contactpersoon, contact_email, plaats)')\
                .eq('id', tender_id)
            
            if not is_super and user_bureau_id:
                query = query.eq('tenderbureau_id', user_bureau_id)
            
            result = query.single().execute()
            
            if result.data:
                tender = result.data
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['btw_nummer'] = bedrijf.get('btw_nummer')
                tender['contactpersoon'] = bedrijf.get('contactpersoon')
                tender['contact_email'] = bedrijf.get('contact_email')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenderbureau = tender.pop('tenderbureaus', None) or {}
                tender['tenderbureau_naam'] = tenderbureau.get('naam')
                
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
        v2.1: Filtert bedrijfsvelden uit (die zitten nu in bedrijven tabel)
        """
        try:
            tender_data = tender.model_dump(exclude_unset=True)
            tender_data = self._filter_removed_fields(tender_data)
            
            if not tender_data.get('tenderbureau_id'):
                bureau_id = await self._get_user_tenderbureau_id(user_id)
                if not bureau_id:
                    raise ValueError("User heeft geen tenderbureau")
                tender_data['tenderbureau_id'] = bureau_id
            
            team_assignments = self._extract_team_assignments(tender_data)
            tender_data = self._serialize_data(tender_data)
            
            print(f"📝 Creating tender for bureau {tender_data.get('tenderbureau_id')}: {tender_data.get('naam')}")
            
            result = self.db.table('tenders')\
                .insert(tender_data)\
                .execute()
            
            created_tender = result.data[0]
            print(f"✅ Tender created: {created_tender['id']}")
            
            if team_assignments:
                await self._save_team_assignments(created_tender['id'], team_assignments)
            
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
        v2.2: Fix Decimal serialization
        """
        try:
            tender_data = tender.model_dump(exclude_unset=True)

            if 'fase' in tender_data and 'fase_status' not in tender_data:
                nieuwe_fase = tender_data['fase']
                eerste_status = await self._get_first_fase_status(nieuwe_fase)
                if eerste_status:
                    tender_data['fase_status'] = eerste_status
                    print(f"🔄 Backend fallback: fase_status gezet naar {eerste_status}")
                else:
                    tender_data['fase_status'] = None

            tender_data = self._filter_removed_fields(tender_data)

            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)

            team_assignments = self._extract_team_assignments(tender_data)
            tender_data = self._serialize_data(tender_data)

            if not is_super:
                tender_data.pop('tenderbureau_id', None)

            print(f"📋 Updating tender {tender_id}")

            if tender_data:
                query = self.db.table('tenders')\
                    .update(tender_data)\
                    .eq('id', tender_id)

                if not is_super and user_bureau_id:
                    query = query.eq('tenderbureau_id', user_bureau_id)

                result = query.execute()

                if not result.data:
                    return None

                updated_tender = result.data[0]
            else:
                query = self.db.table('tenders')\
                    .select('*')\
                    .eq('id', tender_id)

                if not is_super and user_bureau_id:
                    query = query.eq('tenderbureau_id', user_bureau_id)

                result = query.execute()

                if not result.data:
                    return None

                updated_tender = result.data[0]

            if team_assignments is not None:
                await self._save_team_assignments(tender_id, team_assignments)

            updated_tender['team_assignments'] = await self._get_team_assignments(tender_id)

            print(f"✅ Tender updated: {updated_tender['id']}")
            return updated_tender

        except Exception as e:
            print(f"❌ Error updating tender: {e}")
            raise

    async def _get_first_fase_status(self, fase: str) -> Optional[str]:
        """Haal de eerste status op voor een fase uit de fase_statussen tabel."""
        try:
            result = self.db.table('fase_statussen')\
                .select('status_key')\
                .eq('fase', fase)\
                .order('volgorde', desc=False)\
                .limit(1)\
                .execute()
            if result.data:
                return result.data[0]['status_key']
            return None
        except Exception as e:
            print(f"⚠️ Fout bij ophalen eerste fase status: {e}")
            return None
    
    async def delete_tender(self, tender_id: str, user_id: str) -> bool:
        """Delete a tender."""
        try:
            user_bureau_id = await self._get_user_tenderbureau_id(user_id)
            is_super = await self._is_super_admin(user_id)
            
            query = self.db.table('tenders')\
                .delete()\
                .eq('id', tender_id)
            
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
        """Get tenders by fase for user's tenderbureau."""
        try:
            bureau_id = tenderbureau_id or await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                return []
            
            result = self.db.table('tenders')\
                .select('*, tenderbureaus(naam), bedrijven(bedrijfsnaam, kvk_nummer, plaats)')\
                .eq('tenderbureau_id', bureau_id)\
                .eq('fase', fase)\
                .order('created_at', desc=True)\
                .execute()
            
            tenders = []
            for tender in result.data:
                tender['team_assignments'] = await self._get_team_assignments(tender['id'])
                
                bedrijf = tender.pop('bedrijven', None) or {}
                tender['bedrijfsnaam'] = bedrijf.get('bedrijfsnaam')
                tender['kvk_nummer'] = bedrijf.get('kvk_nummer')
                tender['bedrijfs_plaats'] = bedrijf.get('plaats')
                
                tenderbureau = tender.pop('tenderbureaus', None) or {}
                tender['tenderbureau_naam'] = tenderbureau.get('naam')
                
                tenders.append(tender)

            return tenders
            
        except Exception as e:
            print(f"❌ Error getting tenders by fase: {e}")
            raise
    
    async def get_tender_stats(self, user_id: str, tenderbureau_id: Optional[str] = None) -> dict:
        """Get tender statistics for a tenderbureau."""
        try:
            bureau_id = tenderbureau_id or await self._get_user_tenderbureau_id(user_id)
            
            if not bureau_id:
                return {'total': 0, 'by_fase': {}, 'by_status': {}}
            
            result = self.db.table('tenders')\
                .select('fase, status')\
                .eq('tenderbureau_id', bureau_id)\
                .execute()
            
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