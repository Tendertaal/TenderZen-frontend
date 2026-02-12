"""
Planning & Checklist Service — Backend business logic
TenderZen v3.3 — Agenda: ongepland + niet-toegewezen taken zichtbaar

Bevat:
- CRUD voor planning_taken (per tender)
- CRUD voor checklist_items (per tender)
- Template management (per bureau)
- Auto-populate vanuit templates bij aanmaken tender
- Tellingen voor kaart badges
- Agenda data (alle taken over alle tenders, incl. super-admin alle bureaus)

INSTALLATIE:
Kopieer naar Backend/app/services/planning_service.py
"""
from typing import List, Optional, Dict, Any
from supabase import Client


class PlanningService:
    """Service voor planning taken, checklist items en templates"""
    
    def __init__(self, db: Client):
        self.db = db
    
    # ============================================
    # HELPER: Bureau ID ophalen
    # ============================================
    
    async def _get_user_bureau_id(self, user_id: str) -> Optional[str]:
        """Haal tenderbureau_id op voor een user"""
        try:
            result = self.db.table('user_bureau_access')\
                .select('tenderbureau_id')\
                .eq('user_id', user_id)\
                .eq('is_active', True)\
                .order('last_accessed_at', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data:
                bureau_id = result.data[0]['tenderbureau_id']
                return bureau_id
            
            # Fallback naar users tabel
            result = self.db.table('users')\
                .select('tenderbureau_id')\
                .eq('id', user_id)\
                .single()\
                .execute()
            
            bureau_id = result.data.get('tenderbureau_id') if result.data else None
            return bureau_id
        except Exception as e:
            print(f"⚠️ Error getting bureau_id for user {user_id[:8]}...: {e}")
            return None
    
    async def _is_super_admin(self, user_id: str) -> bool:
        """Check of user een super_admin is"""
        try:
            result = self.db.table('users')\
                .select('role')\
                .eq('id', user_id)\
                .single()\
                .execute()
            return result.data.get('role') == 'super_admin' if result.data else False
        except Exception:
            return False
    
    async def _get_tender_bureau_id(self, tender_id: str) -> Optional[str]:
        """Haal tenderbureau_id op voor een tender"""
        try:
            result = self.db.table('tenders')\
                .select('tenderbureau_id')\
                .eq('id', tender_id)\
                .single()\
                .execute()
            bureau_id = result.data.get('tenderbureau_id') if result.data else None
            return bureau_id
        except Exception as e:
            print(f"❌ _get_tender_bureau_id error: {e}")
            return None
    
    # ============================================
    # PLANNING TAKEN — CRUD
    # ============================================
    
    async def get_planning_taken(self, tender_id: str) -> List[dict]:
        """Haal alle planning taken op voor een tender"""
        try:
            result = self.db.table('planning_taken')\
                .select('*')\
                .eq('tender_id', tender_id)\
                .order('volgorde')\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"❌ Error getting planning taken: {e}")
            return []
    
    async def create_planning_taak(self, tender_id: str, user_id: str, taak_data: dict) -> dict:
        """Maak een nieuwe planning taak"""
        bureau_id = await self._get_tender_bureau_id(tender_id)
        if not bureau_id:
            raise ValueError("Tender niet gevonden of geen bureau")
        
        insert_data = {
            'tender_id': tender_id,
            'tenderbureau_id': bureau_id,
            'taak_naam': taak_data.get('taak_naam', ''),
            'categorie': taak_data.get('categorie', 'Algemeen'),
            'beschrijving': taak_data.get('beschrijving'),
            'status': taak_data.get('status', 'todo'),
            'is_milestone': taak_data.get('is_milestone', False),
            'datum': taak_data.get('datum'),
            'toegewezen_aan': taak_data.get('toegewezen_aan', []),
            'volgorde': taak_data.get('volgorde', 0),
        }
        
        result = self.db.table('planning_taken')\
            .insert(insert_data)\
            .execute()
        
        return result.data[0] if result.data else {}
    
    async def update_planning_taak(self, taak_id: str, update_data: dict) -> dict:
        """Update een planning taak"""
        allowed = {'taak_naam', 'categorie', 'beschrijving', 'status', 
                   'is_milestone', 'datum', 'toegewezen_aan', 'volgorde'}
        filtered = {k: v for k, v in update_data.items() if k in allowed}
        
        result = self.db.table('planning_taken')\
            .update(filtered)\
            .eq('id', taak_id)\
            .execute()
        
        return result.data[0] if result.data else {}
    
    async def delete_planning_taak(self, taak_id: str) -> bool:
        """Verwijder een planning taak"""
        self.db.table('planning_taken')\
            .delete()\
            .eq('id', taak_id)\
            .execute()
        return True
    
    # ============================================
    # CHECKLIST ITEMS — CRUD
    # ============================================
    
    async def get_checklist_items(self, tender_id: str) -> List[dict]:
        """Haal alle checklist items op voor een tender"""
        try:
            result = self.db.table('checklist_items')\
                .select('*')\
                .eq('tender_id', tender_id)\
                .order('volgorde')\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"❌ Error getting checklist items: {e}")
            return []
    
    async def create_checklist_item(self, tender_id: str, user_id: str, item_data: dict) -> dict:
        """Maak een nieuw checklist item"""
        bureau_id = await self._get_tender_bureau_id(tender_id)
        if not bureau_id:
            raise ValueError("Tender niet gevonden of geen bureau")
        
        insert_data = {
            'tender_id': tender_id,
            'tenderbureau_id': bureau_id,
            'taak_naam': item_data.get('taak_naam', ''),
            'sectie': item_data.get('sectie', 'Documenten'),
            'beschrijving': item_data.get('beschrijving'),
            'is_verplicht': item_data.get('is_verplicht', True),
            'status': item_data.get('status', 'pending'),
            'volgorde': item_data.get('volgorde', 0),
        }
        
        result = self.db.table('checklist_items')\
            .insert(insert_data)\
            .execute()
        
        return result.data[0] if result.data else {}
    
    async def update_checklist_item(self, item_id: str, update_data: dict) -> dict:
        """Update een checklist item"""
        allowed = {'taak_naam', 'sectie', 'beschrijving', 'is_verplicht', 
                   'status', 'verantwoordelijke', 'deadline', 'volgorde', 'notitie'}
        filtered = {k: v for k, v in update_data.items() if k in allowed}
        
        result = self.db.table('checklist_items')\
            .update(filtered)\
            .eq('id', item_id)\
            .execute()
        
        return result.data[0] if result.data else {}
    
    async def delete_checklist_item(self, item_id: str) -> bool:
        """Verwijder een checklist item"""
        self.db.table('checklist_items')\
            .delete()\
            .eq('id', item_id)\
            .execute()
        return True
    
    # ============================================
    # TELLINGEN (voor kaart badges)
    # ============================================
    
    async def get_planning_counts(self, user_id: str, tenderbureau_id: Optional[str] = None) -> Dict[str, dict]:
        """
        Haal tellingen op voor alle tenders in het bureau.
        Returns: { "tender-uuid": { planning_done, planning_total, checklist_done, checklist_total } }
        """
        bureau_id = tenderbureau_id or await self._get_user_bureau_id(user_id)
        if not bureau_id:
            return {}
        
        try:
            planning = self.db.table('planning_taken')\
                .select('tender_id, status')\
                .eq('tenderbureau_id', bureau_id)\
                .execute()
            
            checklist = self.db.table('checklist_items')\
                .select('tender_id, status')\
                .eq('tenderbureau_id', bureau_id)\
                .execute()
            
            counts = {}
            
            for row in (planning.data or []):
                tid = row['tender_id']
                if tid not in counts:
                    counts[tid] = {'planning_done': 0, 'planning_total': 0, 'checklist_done': 0, 'checklist_total': 0}
                counts[tid]['planning_total'] += 1
                if row['status'] == 'done':
                    counts[tid]['planning_done'] += 1
            
            for row in (checklist.data or []):
                tid = row['tender_id']
                if tid not in counts:
                    counts[tid] = {'planning_done': 0, 'planning_total': 0, 'checklist_done': 0, 'checklist_total': 0}
                counts[tid]['checklist_total'] += 1
                if row['status'] == 'completed':
                    counts[tid]['checklist_done'] += 1
            
            return counts
            
        except Exception as e:
            print(f"❌ Error getting planning counts: {e}")
            return {}
    
    async def get_tender_counts(self, tender_id: str) -> dict:
        """Tellingen voor één tender"""
        try:
            planning = self.db.table('planning_taken')\
                .select('status')\
                .eq('tender_id', tender_id)\
                .execute()
            
            checklist = self.db.table('checklist_items')\
                .select('status')\
                .eq('tender_id', tender_id)\
                .execute()
            
            p_data = planning.data or []
            c_data = checklist.data or []
            
            return {
                'planning_done': sum(1 for r in p_data if r['status'] == 'done'),
                'planning_total': len(p_data),
                'checklist_done': sum(1 for r in c_data if r['status'] == 'completed'),
                'checklist_total': len(c_data),
            }
        except Exception as e:
            print(f"❌ Error getting tender counts: {e}")
            return {'planning_done': 0, 'planning_total': 0, 'checklist_done': 0, 'checklist_total': 0}
    
    # ============================================
    # TEMPLATES — CRUD (admin)
    # ============================================
    
    async def get_planning_templates(self, user_id: str, template_naam: str = 'Standaard') -> List[dict]:
        """Haal planning templates op voor het bureau van de user"""
        bureau_id = await self._get_user_bureau_id(user_id)
        if not bureau_id:
            return []
        try:
            result = self.db.table('planning_templates')\
                .select('*, planning_template_taken(*)')\
                .eq('tenderbureau_id', bureau_id)\
                .eq('naam', template_naam)\
                .eq('is_actief', True)\
                .order('naam')\
                .execute()
            # Transformeer naar response format
            templates = []
            for tmpl in (result.data or []):
                taken = tmpl.pop('planning_template_taken', [])
                templates.append({
                    **tmpl,
                    'taken': sorted(taken, key=lambda t: t.get('volgorde', 0))
                })
            return templates
        except Exception as e:
            print(f"❌ Error getting planning templates: {e}")
            return []
    
    async def get_checklist_templates(self, user_id: str, template_naam: str = 'Standaard') -> List[dict]:
        """Haal checklist templates op voor het bureau van de user"""
        bureau_id = await self._get_user_bureau_id(user_id)
        if not bureau_id:
            return []
        try:
            result = self.db.table('planning_templates')\
                .select('*, planning_template_taken(*)')\
                .eq('tenderbureau_id', bureau_id)\
                .eq('naam', template_naam)\
                .eq('type', 'checklist')\
                .eq('is_actief', True)\
                .execute()
            templates = []
            for tmpl in (result.data or []):
                taken = tmpl.pop('planning_template_taken', [])
                templates.append({
                    **tmpl,
                    'taken': sorted(taken, key=lambda t: t.get('volgorde', 0))
                })
            return templates
        except Exception as e:
            print(f"❌ Error getting checklist templates: {e}")
            return []
    
    async def get_template_names(self, user_id: str) -> List[str]:
        """Haal beschikbare template namen op voor het bureau"""
        bureau_id = await self._get_user_bureau_id(user_id)
        if not bureau_id:
            return []
        try:
            result = self.db.table('planning_templates')\
                .select('naam')\
                .eq('tenderbureau_id', bureau_id)\
                .eq('is_actief', True)\
                .execute()
            names = list(set(r['naam'] for r in (result.data or [])))
            return sorted(names)
        except Exception as e:
            print(f"❌ Error getting template names: {e}")
            return []
    
    # ============================================
    # AUTO-POPULATE vanuit templates
    # ============================================
    
    async def populate_from_templates(
        self, 
        tender_id: str, 
        user_id: str,
        template_naam: str = 'Standaard',
        overwrite: bool = False
    ) -> dict:
        print(f"\U0001F534\U0001F534\U0001F534 populate_from_templates CALLED: tender={tender_id}, template={template_naam}")
        """
        Kopieer template taken naar een tender.
        
        Zoekt in planning_templates (type='planning' en type='checklist')
        en kopieert de bijbehorende planning_template_taken naar
        planning_taken en checklist_items tabellen.
        """
        bureau_id = await self._get_tender_bureau_id(tender_id)
        if not bureau_id:
            raise ValueError("Tender niet gevonden of geen bureau")
        
        # Check of tender al items heeft
        existing_planning = await self.get_planning_taken(tender_id)
        existing_checklist = await self.get_checklist_items(tender_id)
        
        if (existing_planning or existing_checklist) and not overwrite:
            return {
                'planning_taken': len(existing_planning),
                'checklist_items': len(existing_checklist),
                'skipped': True,
                'message': 'Tender heeft al items. Gebruik overwrite=true om te overschrijven.',
                'template_naam': template_naam
            }
        
        # Als overwrite: verwijder bestaande items
        if overwrite:
            self.db.table('planning_taken')\
                .delete()\
                .eq('tender_id', tender_id)\
                .execute()
            self.db.table('checklist_items')\
                .delete()\
                .eq('tender_id', tender_id)\
                .execute()
        
        # Direct manual populate (RPC niet nodig)
        return await self._populate_manual(tender_id, bureau_id, template_naam)
    
    async def _populate_manual(self, tender_id: str, bureau_id: str, template_naam: str) -> dict:
        """
        Kopieer template taken naar tender's planning_taken en checklist_items.
        
        Tabel-structuur:
        - planning_templates: id, naam, type ('planning'|'checklist'), tenderbureau_id, is_standaard, is_actief
        - planning_template_taken: id, template_id, naam, beschrijving, rol, t_minus_werkdagen, 
                                   duur_werkdagen, is_mijlpaal, is_verplicht, volgorde
        """
        planning_count = 0
        checklist_count = 0
        
        try:
            # ─── PLANNING TAKEN ───────────────────────────
            # Stap 1: Zoek het planning template
            planning_tmpl = self.db.table('planning_templates')\
                .select('id')\
                .eq('naam', template_naam)\
                .eq('type', 'planning')\
                .eq('is_actief', True)\
                .limit(1)\
                .execute()
            
            if planning_tmpl.data:
                tmpl_id = planning_tmpl.data[0]['id']
                
                # Stap 2: Haal template taken op
                taken = self.db.table('planning_template_taken')\
                    .select('*')\
                    .eq('template_id', tmpl_id)\
                    .order('volgorde')\
                    .execute()
                
                if taken.data:
                    # Stap 3: Groepeer taken per categorie op basis van volgorde
                    def get_categorie(volgorde):
                        if volgorde <= 30:
                            return 'Voorbereiding'
                        elif volgorde <= 100:
                            return 'Schrijven & Review'
                        else:
                            return 'Afronding & Indiening'
                    
                    inserts = [{
                        'tender_id': tender_id,
                        'tenderbureau_id': bureau_id,
                        'taak_naam': t['naam'],
                        'categorie': get_categorie(t.get('volgorde', 0)),
                        'beschrijving': t.get('beschrijving'),
                        'is_milestone': t.get('is_mijlpaal', False),
                        'volgorde': t.get('volgorde', 0),
                        'status': 'todo'
                    } for t in taken.data]
                    
                    self.db.table('planning_taken').insert(inserts).execute()
                    planning_count = len(inserts)
                    print(f"✅ {planning_count} planning taken gekopieerd naar tender {tender_id}")
                else:
                    print(f"⚠️ Planning template '{template_naam}' gevonden (id={tmpl_id}) maar heeft 0 taken")
            else:
                print(f"⚠️ Geen planning template gevonden met naam='{template_naam}', type='planning', is_actief=True")
            
            # ─── CHECKLIST ITEMS ──────────────────────────
            # Stap 1: Zoek het checklist template
            checklist_tmpl = self.db.table('planning_templates')\
                .select('id')\
                .eq('naam', template_naam)\
                .eq('type', 'checklist')\
                .eq('is_actief', True)\
                .limit(1)\
                .execute()
            
            if checklist_tmpl.data:
                tmpl_id = checklist_tmpl.data[0]['id']
                
                # Stap 2: Haal template taken op
                items = self.db.table('planning_template_taken')\
                    .select('*')\
                    .eq('template_id', tmpl_id)\
                    .order('volgorde')\
                    .execute()
                
                if items.data:
                    # Stap 3: Groepeer per sectie op basis van rol
                    def get_sectie(rol):
                        if rol in ('tendermanager', 'reviewer'):
                            return 'Verklaringen & Formulieren'
                        elif rol in ('schrijver',):
                            return 'Inhoudelijke Documenten'
                        elif rol in ('calculator',):
                            return 'Financieel'
                        else:
                            return 'Overige Documenten'
                    
                    cl_inserts = [{
                        'tender_id': tender_id,
                        'tenderbureau_id': bureau_id,
                        'taak_naam': t['naam'],
                        'sectie': get_sectie(t.get('rol', '')),
                        'beschrijving': t.get('beschrijving'),
                        'is_verplicht': t.get('is_verplicht', True),
                        'volgorde': t.get('volgorde', 0),
                        'status': 'pending'
                    } for t in items.data]
                    
                    self.db.table('checklist_items').insert(cl_inserts).execute()
                    checklist_count = len(cl_inserts)
                    print(f"✅ {checklist_count} checklist items gekopieerd naar tender {tender_id}")
                else:
                    print(f"⚠️ Checklist template '{template_naam}' gevonden (id={tmpl_id}) maar heeft 0 items")
            else:
                print(f"⚠️ Geen checklist template gevonden met naam='{template_naam}', type='checklist', is_actief=True")
            
        except Exception as e:
            print(f"❌ Error bij populate: {e}")
            import traceback
            traceback.print_exc()
        
        return {
            'planning_taken': planning_count,
            'checklist_items': checklist_count,
            'skipped': False,
            'template_naam': template_naam
        }
    
    # ============================================
    # AGENDA — Alle taken over alle tenders
    # ============================================
    
    async def get_agenda_data(self, user_id: str, start_date: str, end_date: str, team_member_id: str = None):
        """
        Haal alle taken op over alle tenders voor de agenda.
        Combineert planning_taken EN checklist_items.
        
        Inclusief:
        - Taken MET datum in het bereik (verschijnen op weekdag)
        - Taken ZONDER datum (verschijnen als 'ongepland')
        - Taken ZONDER toegewezen persoon (altijd zichtbaar)
        
        Super-admin in "Alle bureau's" mode: geen bureau filter → alle taken.
        Normale user: alleen taken van eigen bureau.
        """
        bureau_id = await self._get_user_bureau_id(user_id)
        is_super = await self._is_super_admin(user_id)
        
        # Als geen bureau EN geen super-admin → lege data
        if not bureau_id and not is_super:
            print(f"⚠️ Agenda: geen bureau gevonden voor user {user_id[:8]}...")
            return {"taken": [], "tenders": {}, "team_members": []}
        
        print(f"📅 Agenda query: bureau={bureau_id or 'ALLE'}, super={is_super}, range={start_date} → {end_date}")
        
        # ── 1A. Planning taken MET datum in bereik ──
        dated_query = self.db.table('planning_taken')\
            .select('id, tender_id, tenderbureau_id, taak_naam, categorie, status, datum, toegewezen_aan, is_milestone, volgorde')\
            .gte('datum', f"{start_date}T00:00:00")\
            .lte('datum', f"{end_date}T23:59:59")
        
        if bureau_id:
            dated_query = dated_query.eq('tenderbureau_id', bureau_id)
        
        dated_result = dated_query.order('datum').order('volgorde').execute()
        dated_planning = dated_result.data or []
        
        # ── 1B. Planning taken ZONDER datum (ongepland) ──
        undated_query = self.db.table('planning_taken')\
            .select('id, tender_id, tenderbureau_id, taak_naam, categorie, status, datum, toegewezen_aan, is_milestone, volgorde')\
            .is_('datum', 'null')
        
        if bureau_id:
            undated_query = undated_query.eq('tenderbureau_id', bureau_id)
        
        undated_result = undated_query.order('volgorde').execute()
        undated_planning = undated_result.data or []
        
        # Combineer, voorkom duplicaten
        seen_ids = set()
        planning_taken = []
        for pt in dated_planning + undated_planning:
            if pt['id'] not in seen_ids:
                seen_ids.add(pt['id'])
                planning_taken.append(pt)
        
        print(f"   📋 Planning taken: {len(dated_planning)} gepland + {len(undated_planning)} ongepland = {len(planning_taken)} totaal")
        
        # ── 2A. Checklist items MET deadline in bereik ──
        cl_dated_query = self.db.table('checklist_items')\
            .select('id, tender_id, tenderbureau_id, taak_naam, sectie, status, deadline, verantwoordelijke_data, volgorde')\
            .gte('deadline', start_date)\
            .lte('deadline', end_date)
        
        if bureau_id:
            cl_dated_query = cl_dated_query.eq('tenderbureau_id', bureau_id)
        
        cl_dated_result = cl_dated_query.order('deadline').order('volgorde').execute()
        dated_checklist = cl_dated_result.data or []
        
        # ── 2B. Checklist items ZONDER deadline (ongepland) ──
        cl_undated_query = self.db.table('checklist_items')\
            .select('id, tender_id, tenderbureau_id, taak_naam, sectie, status, deadline, verantwoordelijke_data, volgorde')\
            .is_('deadline', 'null')
        
        if bureau_id:
            cl_undated_query = cl_undated_query.eq('tenderbureau_id', bureau_id)
        
        cl_undated_result = cl_undated_query.order('volgorde').execute()
        undated_checklist = cl_undated_result.data or []
        
        # Combineer checklist
        seen_cl_ids = set()
        checklist_items = []
        for ci in dated_checklist + undated_checklist:
            if ci['id'] not in seen_cl_ids:
                seen_cl_ids.add(ci['id'])
                checklist_items.append(ci)
        
        print(f"   ✅ Checklist items: {len(dated_checklist)} gepland + {len(undated_checklist)} ongepland = {len(checklist_items)} totaal")
        
        # ── 3. Combineer tot uniform formaat ──
        taken = []
        tender_ids = set()
        
        for pt in planning_taken:
            toegewezen = pt.get('toegewezen_aan') or []
            taak = {
                "id": pt['id'],
                "tender_id": pt['tender_id'],
                "taak_naam": pt['taak_naam'],
                "categorie": pt.get('categorie', ''),
                "status": pt['status'],
                "datum": pt['datum'],  # None voor ongepland
                "toegewezen_aan": toegewezen,
                "is_milestone": pt.get('is_milestone', False),
                "is_ongepland": pt['datum'] is None,
                "is_niet_toegewezen": len(toegewezen) == 0,
                "bron": "planning"
            }
            taken.append(taak)
            tender_ids.add(pt['tender_id'])
        
        for ci in checklist_items:
            toegewezen = []
            if ci.get('verantwoordelijke_data'):
                vd = ci['verantwoordelijke_data']
                if isinstance(vd, dict) and vd.get('id'):
                    toegewezen = [vd]
            
            taak = {
                "id": ci['id'],
                "tender_id": ci['tender_id'],
                "taak_naam": ci['taak_naam'],
                "categorie": ci.get('sectie', 'Checklist'),
                "status": "done" if ci['status'] == 'completed' else "todo",
                "datum": f"{ci['deadline']}T00:00:00" if ci.get('deadline') else None,
                "toegewezen_aan": toegewezen,
                "is_milestone": False,
                "is_ongepland": ci.get('deadline') is None,
                "is_niet_toegewezen": len(toegewezen) == 0,
                "bron": "checklist"
            }
            taken.append(taak)
            tender_ids.add(ci['tender_id'])
        
        # ── 4. Filter op teamlid (optioneel) ──
        # BELANGRIJK: niet-toegewezen taken blijven ALTIJD zichtbaar
        if team_member_id:
            filtered_taken = []
            for taak in taken:
                # Niet-toegewezen taken altijd tonen (moeten nog worden toegewezen)
                if taak.get('is_niet_toegewezen'):
                    filtered_taken.append(taak)
                    continue
                # Check of dit teamlid is toegewezen
                for persoon in (taak.get('toegewezen_aan') or []):
                    if isinstance(persoon, dict) and persoon.get('id') == team_member_id:
                        filtered_taken.append(taak)
                        break
            taken = filtered_taken
            tender_ids = set(t['tender_id'] for t in taken)
        
        # ── 5. Haal tender info op ──
        tenders = {}
        if tender_ids:
            tender_list = list(tender_ids)
            tender_query = self.db.table('tenders')\
                .select('id, naam, opdrachtgever, fase, fase_status, deadline_indiening, publicatie_datum, tenderbureau_id')\
                .in_('id', tender_list)
            
            if bureau_id:
                tender_query = tender_query.eq('tenderbureau_id', bureau_id)
            
            tender_result = tender_query.execute()
            
            for t in (tender_result.data or []):
                tenders[t['id']] = {
                    "id": t['id'],
                    "naam": t['naam'],
                    "opdrachtgever": t.get('opdrachtgever', ''),
                    "fase": t.get('fase', ''),
                    "fase_status": t.get('fase_status', ''),
                    "deadline_indiening": t.get('deadline_indiening'),
                    "publicatie_datum": t.get('publicatie_datum'),
                    "tenderbureau_id": t.get('tenderbureau_id', ''),
                }
            
            # ── 6. Planning voortgang per tender ──
            for tender_id in tender_ids:
                if tender_id in tenders:
                    p_query = self.db.table('planning_taken')\
                        .select('status')\
                        .eq('tender_id', tender_id)
                    
                    if bureau_id:
                        p_query = p_query.eq('tenderbureau_id', bureau_id)
                    
                    p_result = p_query.execute()
                    p_items = p_result.data or []
                    tenders[tender_id]['planning_total'] = len(p_items)
                    tenders[tender_id]['planning_done'] = sum(1 for i in p_items if i['status'] == 'done')
        
        # ── 7. Team members ──
        team_query = self.db.table('team_members')\
            .select('id, naam, email, initialen, avatar_kleur, rol')\
            .eq('is_active', True)\
            .order('naam')
        
        if bureau_id:
            team_query = team_query.eq('tenderbureau_id', bureau_id)
        
        team_result = team_query.execute()
        team_members = team_result.data or []
        
        # Stats
        ongepland_count = sum(1 for t in taken if t.get('is_ongepland'))
        niet_toegewezen_count = sum(1 for t in taken if t.get('is_niet_toegewezen'))
        print(f"   📊 Resultaat: {len(taken)} taken ({ongepland_count} ongepland, {niet_toegewezen_count} niet-toegewezen), {len(tenders)} tenders, {len(team_members)} teamleden")
        
        return {
            "taken": taken,
            "tenders": tenders,
            "team_members": team_members
        }