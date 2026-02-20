# ================================================================
# TenderZen — BackplanningService
# Backend/app/services/backplanning_service.py
# Bestandsnaam: backplanning_service_20260217_1730.py
# Versie: 2.1 — FIX: 'planning' → 'planning_taken'
# ================================================================
#
# WIJZIGINGEN v2.1 (2026-02-17 17:30):
# - generate_backplanning(): return key 'planning' → 'planning_taken'
#   → Frontend verwacht 'planning_taken', niet 'planning'
# - Debug logging toegevoegd aan return statement
#
# WIJZIGINGEN v2.0:
# - get_workload(): .contains('toegewezen_aan', ...) vervangen door
#   RPC call naar get_workload_for_users() PostgreSQL-functie.
#   → Omzeilt PostgREST jsonb-array bug volledig.
# - _check_workload(): idem, nu via get_workload_per_dag() RPC.
# - _get_team_details(): extra null-guard toegevoegd.
# - Uitgebreide logging toegevoegd voor diagnose bij problemen.
#
# VEREIST:
#   Migratie_WorkloadRPC_20260217_1100.sql moet zijn uitgevoerd
#   in Supabase voordat deze service gebruikt kan worden.
# ================================================================

from datetime import date, timedelta
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class BackplanningService:
    """
    Genereert een back-planning en haalt workload-data op.

    Gebruikt PostgreSQL RPC-functies voor alle queries op de
    jsonb-kolom `toegewezen_aan` in planning_taken, om de
    bekende PostgREST/supabase-py jsonb-array bug te vermijden.
    """

    def __init__(self, supabase_client):
        self.db = supabase_client

    # ──────────────────────────────────────────────────────────────
    # PUBLIEKE METHODEN
    # ──────────────────────────────────────────────────────────────

    async def generate_backplanning(
        self,
        deadline: date,
        template_id: str,
        team_assignments: Dict[str, str],   # rol → user_id
        tenderbureau_id: str,
        tender_id: Optional[str] = None,
        include_checklist: bool = True
    ) -> dict:
        """Hoofdfunctie: genereer complete back-planning."""

        # 1. Haal template taken op
        template_taken = await self._get_template_taken(template_id)

        # 2. Haal feestdagen op
        feestdagen = await self._get_feestdagen(tenderbureau_id, deadline.year)

        # 3. Haal team member details op
        team_details = await self._get_team_details(
            list(set(uid for uid in team_assignments.values() if uid))
        )

        # 4. Bereken datums (back-planning)
        planning = []
        for taak in template_taken:
            taak_datum = self._bereken_werkdag(
                deadline, taak['t_minus_werkdagen'], feestdagen
            )
            eind_datum = taak_datum
            duur = taak.get('duur_werkdagen', 1) or 1
            if duur > 1:
                eind_datum = self._bereken_vooruit(
                    taak_datum, duur - 1, feestdagen
                )

            user_id = team_assignments.get(taak['rol'])

            planning.append({
                'naam': taak['naam'],
                'beschrijving': taak.get('beschrijving'),
                'datum': taak_datum.isoformat(),
                'eind_datum': eind_datum.isoformat(),
                'duur_werkdagen': duur,
                'rol': taak['rol'],
                'categorie': taak.get('categorie', 'algemeen'),
                'toegewezen_aan': [user_id] if user_id else [],  # Array van user IDs
                'is_mijlpaal': taak.get('is_mijlpaal', False),
                't_minus': taak['t_minus_werkdagen'],
                'volgorde': taak.get('volgorde', 0)
            })

        # 5. Check workload conflicten
        workload_warnings = []
        if tender_id:
            workload_warnings = await self._check_workload(
                planning, tenderbureau_id, tender_id
            )
            for taak in planning:
                if taak['toegewezen_aan']:
                    for warning in workload_warnings:
                        if (warning['persoon_id'] == taak['toegewezen_aan']['id']
                                and warning['datum'] == taak['datum']):
                            taak['conflict'] = {
                                'type': 'workload',
                                'bericht': warning['bericht'],
                                'severity': warning['severity']
                            }

        # 6. Optioneel: checklist items genereren
        checklist_items = []
        if include_checklist:
            checklist_items = await self._generate_checklist(
                template_id, deadline, feestdagen, team_assignments, team_details
            )

        # 7. Metadata berekenen
        alle_datums = [
            date.fromisoformat(t['datum'])
            for t in planning
            if t.get('datum')
        ]
        eerste = min(alle_datums).isoformat() if alle_datums else None
        laatste = max(alle_datums).isoformat() if alle_datums else None

        # DEBUG v2.1: Log wat we gaan retourneren
        logger.info("=" * 60)
        logger.info("✅ BackplanningService.generate_backplanning RESULT:")
        logger.info(f"   📊 {len(planning)} planning taken")
        logger.info(f"   ✓ {len(checklist_items)} checklist items")
        logger.info(f"   ⚠️ {len(workload_warnings)} workload warnings")
        logger.info("=" * 60)

        # FIX v2.1: Return key 'planning' → 'planning_taken'
        return {
            'planning_taken': planning,        # ← WAS: 'planning'
            'checklist_items': checklist_items,
            'workload_warnings': workload_warnings,
            'metadata': {
                'eerste_taak': eerste,
                'laatste_taak': laatste,
                'deadline': deadline.isoformat(),
                'doorlooptijd_werkdagen': len(alle_datums),
                'doorlooptijd_kalenderdagen': (
                    (date.fromisoformat(laatste) - date.fromisoformat(eerste)).days
                    if eerste and laatste else 0
                ),
            }
        }

    async def get_workload(
        self,
        user_ids: List[str],
        start_date: date,
        end_date: date,
        tenderbureau_id: Optional[str] = None
    ) -> dict:
        """
        Haal workload op voor een lijst teamleden in een periode.

        Gebruikt de PostgreSQL RPC-functie `get_workload_for_users`
        om jsonb-array containment buiten PostgREST af te handelen.

        Returns:
            dict: { user_id: { week_key: taak_count, ... }, ... }
        """
        # ── Input validatie ──────────────────────────────────────
        if not user_ids:
            logger.warning("get_workload: geen user_ids meegegeven")
            return {}

        # Filter lege strings en None's
        clean_ids = [uid.strip() for uid in user_ids if uid and uid.strip()]
        if not clean_ids:
            logger.warning("get_workload: alle user_ids waren leeg/None")
            return {}

        logger.info(
            f"get_workload → {len(clean_ids)} users, "
            f"{start_date} t/m {end_date}, bureau={tenderbureau_id}"
        )
        logger.debug(f"get_workload user_ids: {clean_ids}")

        # ── RPC aanroep ──────────────────────────────────────────
        try:
            params = {
                'p_user_ids': clean_ids,
                'p_start':    start_date.isoformat(),
                'p_end':      end_date.isoformat(),
                'p_bureau_id': tenderbureau_id if tenderbureau_id else None
            }
            logger.debug(f"RPC get_workload_for_users params: {params}")

            result = self.db.rpc('get_workload_for_users', params).execute()

            rows = result.data or []
            logger.info(f"get_workload → {len(rows)} rijen terug van RPC")

        except Exception as e:
            logger.error(
                f"RPC get_workload_for_users mislukt: {e}", exc_info=True
            )
            # Geef lege dict terug i.p.v. crash — workload is informatief,
            # niet functioneel-blokkerend voor de TeamStep.
            return {}

        # ── Resultaat transformeren naar frontend-formaat ────────
        # { user_id: { "2026-W07": 3, "2026-W08": 1, ... }, ... }
        workload: Dict[str, Dict[str, int]] = {}

        for row in rows:
            uid = row.get('user_id', '')
            week = row.get('iso_week', '')
            count = row.get('taak_count', 0)

            if not uid or not week:
                continue

            if uid not in workload:
                workload[uid] = {}
            workload[uid][week] = count

        logger.debug(f"get_workload resultaat: {workload}")
        return workload

    # ──────────────────────────────────────────────────────────────
    # PRIVÉ HELPERS
    # ──────────────────────────────────────────────────────────────

    async def _check_workload(
        self,
        planning: list,
        tenderbureau_id: str,
        exclude_tender_id: str
    ) -> list:
        """
        Check of teamleden workload-conflicten hebben.

        Gebruikt de PostgreSQL RPC-functie `get_workload_per_dag`
        om jsonb-array containment buiten PostgREST af te handelen.
        """
        warnings = []

        # Verzamel unieke persoon → datums mapping
        persoon_datums: Dict[str, set] = {}
        for taak in planning:
            if taak.get('toegewezen_aan'):
                pid = taak['toegewezen_aan']['id']
                persoon_datums.setdefault(pid, set()).add(taak['datum'])

        if not persoon_datums:
            return []

        alle_user_ids = list(persoon_datums.keys())
        alle_datums = list(
            {d for datums in persoon_datums.values() for d in datums}
        )

        logger.debug(
            f"_check_workload: {len(alle_user_ids)} users, "
            f"{len(alle_datums)} datums"
        )

        try:
            result = self.db.rpc('get_workload_per_dag', {
                'p_user_ids':       alle_user_ids,
                'p_datums':         alle_datums,
                'p_exclude_tender': exclude_tender_id
            }).execute()

            rows = result.data or []

        except Exception as e:
            logger.error(
                f"RPC get_workload_per_dag mislukt: {e}", exc_info=True
            )
            return []   # Geen conflict-warnings bij fout, niet blokkerend

        # Maak lookup: { user_id: { datum: count } }
        dag_counts: Dict[str, Dict[str, int]] = {}
        for row in rows:
            uid = row.get('user_id', '')
            dag = str(row.get('dag', ''))
            cnt = row.get('taak_count', 0)
            dag_counts.setdefault(uid, {})[dag] = cnt

        # Bouw warnings op voor drempel ≥ 3
        for taak in planning:
            toegewezen = taak.get('toegewezen_aan')
            if not toegewezen or not isinstance(toegewezen, list) or len(toegewezen) == 0:
                continue
            
            pid = toegewezen[0]  # Eerste user_id uit array
            datum = taak['datum']
            bestaand = dag_counts.get(pid, {}).get(datum, 0)

            if bestaand >= 3:
                warnings.append({
                    'persoon_id': pid,
                    'datum': datum,
                    'existing_count': bestaand,
                    'bericht': (
                        f"User heeft al {bestaand} taken op {datum}"
                    ),
                    'severity': 'error' if bestaand >= 5 else 'warning'
                })

        return warnings

    async def _get_template_taken(self, template_id: str) -> list:
        """Haal taken op uit een planning template."""
        result = self.db.table('planning_template_taken') \
            .select('*') \
            .eq('template_id', template_id) \
            .order('volgorde') \
            .execute()
        return result.data or []

    async def _get_feestdagen(self, tenderbureau_id: str, jaar: int) -> set:
        """Haal feestdagen op voor het bureau in een bepaald jaar."""
        result = self.db.table('bureau_feestdagen') \
            .select('datum') \
            .eq('tenderbureau_id', tenderbureau_id) \
            .gte('datum', f'{jaar}-01-01') \
            .lte('datum', f'{jaar}-12-31') \
            .execute()
        return {
            date.fromisoformat(row['datum'])
            for row in (result.data or [])
        }

    async def _get_team_details(self, user_ids: list) -> dict:
        """Haal team member details op voor een lijst user IDs."""
        if not user_ids:
            return {}

        result = self.db.table('v_bureau_team') \
            .select('user_id, naam, initialen, avatar_kleur') \
            .in_('user_id', user_ids) \
            .execute()

        return {
            row['user_id']: {
                'id': row['user_id'],
                'naam': row['naam'],
                'initialen': row.get('initialen', '?'),
                'avatar_kleur': row.get('avatar_kleur', '#6b7280')
            }
            for row in (result.data or [])
            if row.get('user_id')
        }

    async def _generate_checklist(
        self,
        template_id: str,
        deadline: date,
        feestdagen: set,
        team_assignments: dict = None,
        team_details: dict = None
    ) -> list:
        """
        Genereer checklist items op basis van checklist_templates tabel.
        
        FIX v2.2: Gebruikt checklist_templates (per bureau) i.p.v. 
        planning_template_checklist (per planning template).
        """
        try:
            # Haal bureau_id op uit het planning template
            template_result = self.db.table('planning_templates') \
                .select('tenderbureau_id') \
                .eq('id', template_id) \
                .single() \
                .execute()
            
            if not template_result.data:
                logger.warning(f"Template {template_id} niet gevonden voor checklist")
                return []
            
            bureau_id = template_result.data.get('tenderbureau_id')
            if not bureau_id:
                logger.warning("Geen bureau_id in template voor checklist")
                return []
            
            # Haal checklist items op voor dit bureau
            result = self.db.table('checklist_templates') \
                .select('*') \
                .eq('tenderbureau_id', bureau_id) \
                .eq('is_active', True) \
                .order('volgorde') \
                .execute()
            
            items = result.data or []
            logger.info(f"📋 Checklist: {len(items)} items gevonden voor bureau {bureau_id}")
            
        except Exception as e:
            logger.error(f"Fout bij ophalen checklist templates: {e}", exc_info=True)
            return []

        if not items:
            logger.warning("Geen checklist items gevonden")
            return []

        checklist = []
        for item in items:
            # Spreidt items gelijkmatig over laatste 2 weken
            dagen_voor_deadline = max(1, 14 - item.get('volgorde', 0))
            item_datum = self._bereken_werkdag(deadline, dagen_voor_deadline, feestdagen)
            
            # Intelligente toewijzing op basis van sectie
            user_id = None
            sectie = item.get('sectie', '').lower()
            
            if team_assignments:
                if 'financ' in sectie or 'budget' in sectie:
                    user_id = team_assignments.get('calculator')
                elif 'compliance' in sectie or 'juridisch' in sectie:
                    user_id = team_assignments.get('schrijver')
                elif 'kwaliteit' in sectie or 'review' in sectie:
                    user_id = team_assignments.get('reviewer')
                else:
                    user_id = team_assignments.get('tendermanager')
            
            checklist.append({
                'naam': item['taak_naam'],
                'beschrijving': item.get('beschrijving'),
                'datum': item_datum.isoformat(),
                'eind_datum': item_datum.isoformat(),
                'rol': sectie or 'algemeen',
                'categorie': item.get('sectie', 'algemeen'),
                'is_verplicht': item.get('is_verplicht', True),
                'toegewezen_aan': [user_id] if user_id else [],  # Array van user IDs
                't_minus': dagen_voor_deadline,
                'volgorde': item.get('volgorde', 0)
            })
        
        logger.info(f"✅ {len(checklist)} checklist items gegenereerd")
        return checklist

    # ──────────────────────────────────────────────────────────────
    # DATUM BEREKENING HELPERS
    # ──────────────────────────────────────────────────────────────

    def _bereken_werkdag(
        self,
        deadline: date,
        t_minus_werkdagen: int,
        feestdagen: set
    ) -> date:
        """
        Bereken een datum t_minus_werkdagen voor de deadline,
        waarbij weekenden en feestdagen worden overgeslagen.
        """
        result = deadline
        stappen = 0
        while stappen < t_minus_werkdagen:
            result -= timedelta(days=1)
            if result.weekday() < 5 and result not in feestdagen:
                stappen += 1
        return result

    def _bereken_vooruit(
        self,
        start: date,
        werkdagen: int,
        feestdagen: set
    ) -> date:
        """
        Bereken een datum `werkdagen` werkdagen VOORUIT vanaf start.
        """
        result = start
        stappen = 0
        while stappen < werkdagen:
            result += timedelta(days=1)
            if result.weekday() < 5 and result not in feestdagen:
                stappen += 1
        return result