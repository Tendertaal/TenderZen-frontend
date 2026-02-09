# ================================================================
# TenderZen — BackplanningService
# Backend/app/services/backplanning_service.py
# Datum: 2026-02-08
# ================================================================
#
# Genereert een back-planning op basis van:
# - Deadline (T-0)
# - Template met taken en T-minus werkdagen
# - Team toewijzingen (rol → persoon)
# - Feestdagen van het bureau
#
# Gebruikt door:
# - Smart Import Wizard (Stap 5: ResultStep)
# - Planning endpoints
# ================================================================

from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class BackplanningService:
    """
    Genereert een back-planning door terug te tellen vanaf de deadline,
    weekenden en feestdagen overslaand.
    """

    def __init__(self, supabase_client):
        self.db = supabase_client

    # ════════════════════════════════════════════════
    # PUBLIEKE METHODES
    # ════════════════════════════════════════════════

    async def generate_backplanning(
        self,
        deadline: date,
        template_id: str,
        team_assignments: Dict[str, str],  # rol → user_id
        tenderbureau_id: str,
        tender_id: Optional[str] = None,
        include_checklist: bool = True
    ) -> dict:
        """
        Hoofdfunctie: genereer complete back-planning + optioneel checklist.

        Args:
            deadline: Indiendatum (T-0)
            template_id: UUID van het planning template
            team_assignments: Mapping van rol → user_id
            tenderbureau_id: UUID van het bureau
            tender_id: Optioneel, voor workload-check (exclude eigen tender)
            include_checklist: Ook checklist template meenemen

        Returns:
            Dict met planning_taken, checklist_items, workload_warnings, metadata
        """
        logger.info(
            f"Genereer backplanning: deadline={deadline}, "
            f"template={template_id}, rollen={list(team_assignments.keys())}"
        )

        # 1. Haal template taken op
        template_taken = await self._get_template_taken(template_id)
        if not template_taken:
            logger.warning(f"Geen taken gevonden voor template {template_id}")
            return self._empty_result()

        # 2. Haal feestdagen op (huidig jaar + deadline jaar)
        jaren = {date.today().year, deadline.year}
        feestdagen = set()
        for jaar in jaren:
            feestdagen.update(
                await self._get_feestdagen(tenderbureau_id, jaar)
            )

        # 3. Haal team member details op
        unieke_user_ids = list(set(
            uid for uid in team_assignments.values() if uid
        ))
        team_details = await self._get_team_details(unieke_user_ids)

        # 4. Bereken datums (back-planning)
        planning = self._bereken_planning(
            deadline, template_taken, team_assignments, team_details, feestdagen
        )

        # 5. Optioneel: checklist genereren
        checklist_items = []
        if include_checklist:
            checklist_items = await self._generate_checklist(
                deadline, tenderbureau_id, team_assignments,
                team_details, feestdagen
            )

        # 6. Check workload conflicten
        workload_warnings = []
        if tender_id and unieke_user_ids:
            workload_warnings = await self._check_workload(
                planning + checklist_items,
                tenderbureau_id,
                tender_id,
                team_details
            )
            # Voeg conflict info toe aan individuele taken
            self._attach_conflicts(planning, workload_warnings)
            self._attach_conflicts(checklist_items, workload_warnings)

        # 7. Metadata berekenen
        metadata = self._bereken_metadata(deadline, planning, feestdagen)

        result = {
            'planning_taken': planning,
            'checklist_items': checklist_items,
            'workload_warnings': workload_warnings,
            'metadata': metadata
        }

        logger.info(
            f"Backplanning gegenereerd: {len(planning)} taken, "
            f"{len(checklist_items)} checklist items, "
            f"{len(workload_warnings)} warnings"
        )

        return result

    async def get_workload(
        self,
        user_ids: List[str],
        start_date: date,
        end_date: date,
        tenderbureau_id: str
    ) -> dict:
        """
        Haal workload data op voor teamleden in een periode.
        Groepeert op week en toont welke tenders actief zijn.

        Returns:
            Dict met per user_id: naam, weken met taken_count en tender namen
        """
        if not user_ids:
            return {}

        team_details = await self._get_team_details(user_ids)

        # Haal alle planning_taken op in deze periode voor deze gebruikers
        result = self.db.table('planning_taken') \
            .select('toegewezen_aan, datum, tender_id, tenders(naam)') \
            .in_('toegewezen_aan', user_ids) \
            .gte('datum', start_date.isoformat()) \
            .lte('datum', end_date.isoformat()) \
            .execute()

        taken = result.data or []

        # Groepeer per persoon per week
        workload = {}
        for user_id in user_ids:
            details = team_details.get(user_id, {})
            workload[user_id] = {
                'naam': details.get('naam', 'Onbekend'),
                'weken': {}
            }

        for taak in taken:
            uid = taak['toegewezen_aan']
            if uid not in workload:
                continue

            taak_datum = date.fromisoformat(taak['datum'])
            week_key = taak_datum.strftime('%G-W%V')  # ISO week
            tender_naam = taak.get('tenders', {}).get('naam', 'Onbekend')

            if week_key not in workload[uid]['weken']:
                workload[uid]['weken'][week_key] = {
                    'taken': 0,
                    'tenders': []
                }

            week = workload[uid]['weken'][week_key]
            week['taken'] += 1
            if tender_naam not in week['tenders']:
                week['tenders'].append(tender_naam)

        return workload

    # ════════════════════════════════════════════════
    # PLANNING BEREKENING
    # ════════════════════════════════════════════════

    def _bereken_planning(
        self,
        deadline: date,
        template_taken: list,
        team_assignments: Dict[str, str],
        team_details: dict,
        feestdagen: Set[date]
    ) -> list:
        """Bereken concrete datums voor alle template-taken."""
        planning = []

        for taak in template_taken:
            # Startdatum: T-minus werkdagen terug vanaf deadline
            start_datum = self._bereken_werkdag_terug(
                deadline, taak['t_minus_werkdagen'], feestdagen
            )

            # Einddatum: start + duur werkdagen vooruit
            duur = taak.get('duur_werkdagen', 1)
            if duur > 1:
                eind_datum = self._bereken_werkdag_vooruit(
                    start_datum, duur - 1, feestdagen
                )
            else:
                eind_datum = start_datum

            # Koppel persoon via rol
            user_id = team_assignments.get(taak['rol'])
            persoon = team_details.get(user_id) if user_id else None

            planning.append({
                'naam': taak['naam'],
                'beschrijving': taak.get('beschrijving'),
                'datum': start_datum.isoformat(),
                'eind_datum': eind_datum.isoformat(),
                'duur_werkdagen': duur,
                'rol': taak['rol'],
                'toegewezen_aan': persoon,
                'is_mijlpaal': taak.get('is_mijlpaal', False),
                'is_verplicht': taak.get('is_verplicht', True),
                't_minus': taak['t_minus_werkdagen'],
                'volgorde': taak.get('volgorde', 0)
            })

        return planning

    async def _generate_checklist(
        self,
        deadline: date,
        tenderbureau_id: str,
        team_assignments: Dict[str, str],
        team_details: dict,
        feestdagen: Set[date]
    ) -> list:
        """Genereer checklist items op basis van het standaard checklist template."""
        # Zoek het standaard checklist template voor dit bureau
        result = self.db.table('planning_templates') \
            .select('id') \
            .eq('tenderbureau_id', tenderbureau_id) \
            .eq('type', 'checklist') \
            .eq('is_standaard', True) \
            .eq('is_actief', True) \
            .limit(1) \
            .execute()

        if not result.data:
            logger.info("Geen standaard checklist template gevonden")
            return []

        checklist_template_id = result.data[0]['id']
        checklist_taken = await self._get_template_taken(checklist_template_id)

        return self._bereken_planning(
            deadline, checklist_taken, team_assignments,
            team_details, feestdagen
        )

    # ════════════════════════════════════════════════
    # WERKDAG BEREKENING
    # ════════════════════════════════════════════════

    def _bereken_werkdag_terug(
        self,
        vanaf: date,
        werkdagen: int,
        feestdagen: Set[date]
    ) -> date:
        """
        Tel werkdagen terug vanaf een datum.
        Slaat weekenden (za/zo) en feestdagen over.

        Args:
            vanaf: Startdatum (deadline)
            werkdagen: Aantal werkdagen terug (T-minus)
            feestdagen: Set van feestdagen

        Returns:
            Berekende werkdag
        """
        if werkdagen == 0:
            # T-0: als de deadline zelf geen werkdag is, zoek vorige werkdag
            return self._dichtstbijzijnde_werkdag(vanaf, feestdagen, richting=-1)

        current = vanaf
        geteld = 0
        while geteld < werkdagen:
            current -= timedelta(days=1)
            if self._is_werkdag(current, feestdagen):
                geteld += 1

        return current

    def _bereken_werkdag_vooruit(
        self,
        vanaf: date,
        werkdagen: int,
        feestdagen: Set[date]
    ) -> date:
        """Tel werkdagen vooruit vanaf een datum."""
        if werkdagen <= 0:
            return vanaf

        current = vanaf
        geteld = 0
        while geteld < werkdagen:
            current += timedelta(days=1)
            if self._is_werkdag(current, feestdagen):
                geteld += 1

        return current

    def _is_werkdag(self, datum: date, feestdagen: Set[date]) -> bool:
        """Check of een datum een werkdag is (geen weekend, geen feestdag)."""
        return datum.weekday() < 5 and datum not in feestdagen

    def _dichtstbijzijnde_werkdag(
        self,
        datum: date,
        feestdagen: Set[date],
        richting: int = -1
    ) -> date:
        """Zoek de dichtstbijzijnde werkdag (standaard: terug in de tijd)."""
        current = datum
        while not self._is_werkdag(current, feestdagen):
            current += timedelta(days=richting)
        return current

    # ════════════════════════════════════════════════
    # WORKLOAD CHECK
    # ════════════════════════════════════════════════

    async def _check_workload(
        self,
        planning: list,
        tenderbureau_id: str,
        exclude_tender_id: str,
        team_details: dict
    ) -> list:
        """
        Check of teamleden workload-conflicten hebben door bestaande
        taken in de planning te vergelijken.

        Drempels:
        - >= 3 taken op één dag: warning
        - >= 5 taken op één dag: danger
        """
        warnings = []

        # Groepeer geplande taken per persoon + datum
        persoon_datums = defaultdict(set)
        for taak in planning:
            if taak.get('toegewezen_aan') and taak['toegewezen_aan'].get('id'):
                pid = taak['toegewezen_aan']['id']
                persoon_datums[pid].add(taak['datum'])

        for persoon_id, datums in persoon_datums.items():
            for datum in datums:
                try:
                    result = self.db.table('planning_taken') \
                        .select('id', count='exact') \
                        .eq('toegewezen_aan', persoon_id) \
                        .eq('datum', datum) \
                        .neq('tender_id', exclude_tender_id) \
                        .execute()

                    existing_count = result.count or 0

                    if existing_count >= 3:
                        persoon_info = team_details.get(persoon_id, {})
                        persoon_naam = persoon_info.get('naam', 'Onbekend')

                        datum_obj = date.fromisoformat(datum)
                        week_key = datum_obj.strftime('%G-W%V')

                        warnings.append({
                            'persoon_id': persoon_id,
                            'persoon': persoon_naam,
                            'datum': datum,
                            'week': week_key,
                            'taken_count': existing_count,
                            'severity': 'danger' if existing_count >= 5 else 'warning',
                            'bericht': (
                                f"{persoon_naam} heeft al {existing_count} "
                                f"taken op {datum}"
                            )
                        })
                except Exception as e:
                    logger.warning(
                        f"Workload check mislukt voor {persoon_id} op {datum}: {e}"
                    )

        return warnings

    def _attach_conflicts(self, taken: list, warnings: list) -> None:
        """Voeg conflict-info toe aan individuele taken."""
        # Index warnings per persoon+datum voor snelle lookup
        warning_index = {}
        for w in warnings:
            key = (w['persoon_id'], w['datum'])
            warning_index[key] = w

        for taak in taken:
            persoon = taak.get('toegewezen_aan')
            if not persoon or not persoon.get('id'):
                continue

            key = (persoon['id'], taak['datum'])
            if key in warning_index:
                w = warning_index[key]
                taak['conflict'] = {
                    'type': 'workload',
                    'bericht': w['bericht'],
                    'severity': w['severity']
                }

    # ════════════════════════════════════════════════
    # METADATA
    # ════════════════════════════════════════════════

    def _bereken_metadata(
        self,
        deadline: date,
        planning: list,
        feestdagen: Set[date]
    ) -> dict:
        """Bereken samenvattende metadata voor de planning."""
        if not planning:
            return {
                'eerste_taak': None,
                'laatste_taak': None,
                'doorlooptijd_werkdagen': 0,
                'doorlooptijd_kalenderdagen': 0,
                'feestdagen_overgeslagen': []
            }

        datums = [taak['datum'] for taak in planning]
        eerste = min(datums)
        laatste = max(datums)

        eerste_date = date.fromisoformat(eerste)

        # Welke feestdagen vallen in de planningsperiode?
        overgeslagen = sorted([
            d.isoformat() for d in feestdagen
            if eerste_date <= d <= deadline
        ])

        # Bereken werkdagen in de periode
        werkdagen = 0
        current = eerste_date
        while current <= deadline:
            if self._is_werkdag(current, feestdagen):
                werkdagen += 1
            current += timedelta(days=1)

        return {
            'eerste_taak': eerste,
            'laatste_taak': laatste,
            'deadline': deadline.isoformat(),
            'doorlooptijd_werkdagen': werkdagen,
            'doorlooptijd_kalenderdagen': (deadline - eerste_date).days,
            'feestdagen_overgeslagen': overgeslagen
        }

    # ════════════════════════════════════════════════
    # DATABASE QUERIES
    # ════════════════════════════════════════════════

    async def _get_template_taken(self, template_id: str) -> list:
        """Haal alle taken op voor een template, gesorteerd op volgorde."""
        try:
            result = self.db.table('planning_template_taken') \
                .select('*') \
                .eq('template_id', template_id) \
                .order('volgorde') \
                .execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Fout bij ophalen template taken: {e}")
            return []

    async def _get_feestdagen(
        self,
        tenderbureau_id: str,
        jaar: int
    ) -> Set[date]:
        """Haal feestdagen op voor een bureau en jaar."""
        try:
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
        except Exception as e:
            logger.error(f"Fout bij ophalen feestdagen: {e}")
            return set()

    async def _get_team_details(self, user_ids: list) -> dict:
        """
        Haal team member details op.
        Returns dict: user_id → {id, naam, initialen, avatar_kleur}
        """
        if not user_ids:
            return {}

        try:
            result = self.db.table('team_members') \
                .select('id, user_id, naam, initialen, avatar_kleur, standaard_rol, rollen') \
                .in_('user_id', user_ids) \
                .execute()

            return {
                row['user_id']: {
                    'id': row['user_id'],
                    'naam': row['naam'],
                    'initialen': row['initialen'],
                    'avatar_kleur': row.get('avatar_kleur', '#6b7280')
                }
                for row in (result.data or [])
            }
        except Exception as e:
            logger.error(f"Fout bij ophalen team details: {e}")
            return {}

    # ════════════════════════════════════════════════
    # HELPERS
    # ════════════════════════════════════════════════

    def _empty_result(self) -> dict:
        """Retourneer een leeg resultaat."""
        return {
            'planning_taken': [],
            'checklist_items': [],
            'workload_warnings': [],
            'metadata': {
                'eerste_taak': None,
                'laatste_taak': None,
                'doorlooptijd_werkdagen': 0,
                'doorlooptijd_kalenderdagen': 0,
                'feestdagen_overgeslagen': []
            }
        }