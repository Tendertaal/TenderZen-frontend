# ================================================================
# TenderZen — FinalizeService
# Backend/app/services/finalize_service.py
# Datum: 2026-02-09
# ================================================================
#
# Slaat alle wizard-output op in één transactie:
# 1. Tender aanmaken of updaten
# 2. Planning taken opslaan
# 3. Checklist items opslaan
# 4. Team assignments opslaan
# 5. AI documenten koppelen
# 6. Smart import sessie afsluiten
# ================================================================

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import uuid4

logger = logging.getLogger(__name__)


class FinalizeService:
    """
    Slaat de volledige wizard-output op.
    Wordt aangeroepen na stap 5 (ResultStep).
    """

    def __init__(self, supabase_client):
        self.db = supabase_client

    async def finalize(
        self,
        user_id: str,
        tenderbureau_id: str,
        payload: dict
    ) -> dict:
        """
        Hoofdfunctie: sla alles op.

        Args:
            user_id: ID van de ingelogde gebruiker
            tenderbureau_id: ID van het bureau
            payload: Alle data uit de wizard

        Returns:
            Dict met tender_id, tender_naam, en samenvatting
        """
        logger.info(f"Finalize gestart: user={user_id}, bureau={tenderbureau_id}")

        tender_id = payload.get('tender_id')
        import_id = payload.get('import_id')
        metadata = payload.get('metadata', {})
        team_assignments = payload.get('team_assignments', {})
        accepted = payload.get('accepted', [])
        planning_taken = payload.get('planning_taken', [])
        checklist_items = payload.get('checklist_items', [])
        document_ids = payload.get('documents', [])
        planning_metadata = payload.get('planning_metadata', {})

        results = {
            'tender_id': tender_id,
            'tender_naam': None,
            'planning_count': 0,
            'checklist_count': 0,
            'document_count': 0,
            'team_count': 0,
        }

        try:
            # ── 1. Tender aanmaken of updaten ──
            tender_id, tender_naam = await self._upsert_tender(
                tender_id=tender_id,
                metadata=metadata,
                tenderbureau_id=tenderbureau_id,
                user_id=user_id
            )
            results['tender_id'] = tender_id
            results['tender_naam'] = tender_naam

            # ── 2. Planning taken opslaan ──
            if 'planning' in accepted and planning_taken:
                count = await self._save_planning_taken(
                    tender_id=tender_id,
                    planning_taken=planning_taken,
                    tenderbureau_id=tenderbureau_id
                )
                results['planning_count'] = count
                logger.info(f"  Planning: {count} taken opgeslagen")

            # ── 3. Checklist items opslaan ──
            if 'checklist' in accepted and checklist_items:
                count = await self._save_checklist_items(
                    tender_id=tender_id,
                    checklist_items=checklist_items,
                    tenderbureau_id=tenderbureau_id
                )
                results['checklist_count'] = count
                logger.info(f"  Checklist: {count} items opgeslagen")

            # ── 4. Team assignments opslaan ──
            if team_assignments:
                count = await self._save_team_assignments(
                    tender_id=tender_id,
                    team_assignments=team_assignments
                )
                results['team_count'] = count
                logger.info(f"  Team: {count} toewijzingen opgeslagen")

            # ── 5. AI documenten koppelen aan tender ──
            if document_ids:
                count = await self._link_documents(
                    tender_id=tender_id,
                    document_ids=document_ids
                )
                results['document_count'] = count
                logger.info(f"  Documenten: {count} gekoppeld")

            # ── 6. Tender fase updaten ──
            await self._update_tender_fase(
                tender_id=tender_id,
                planning_metadata=planning_metadata
            )

            # ── 7. Smart import sessie afsluiten ──
            if import_id:
                await self._close_import_session(import_id, tender_id)

            logger.info(
                f"Finalize voltooid: tender={tender_id}, "
                f"planning={results['planning_count']}, "
                f"checklist={results['checklist_count']}, "
                f"docs={results['document_count']}"
            )

            return results

        except Exception as e:
            logger.error(f"Finalize fout: {e}", exc_info=True)
            raise

    # ══════════════════════════════════════════════
    # 1. TENDER UPSERT
    # ══════════════════════════════════════════════

    async def _upsert_tender(
        self,
        tender_id: Optional[str],
        metadata: dict,
        tenderbureau_id: str,
        user_id: str
    ) -> tuple:
        """
        Maak een nieuwe tender aan of update een bestaande.
        Returns: (tender_id, tender_naam)
        """
        # Extracteer velden uit metadata
        # metadata kan direct velden bevatten of geneste objecten
        tender_data = self._extract_tender_fields(metadata)
        tender_data['tenderbureau_id'] = tenderbureau_id

        if tender_id:
            # Update bestaande tender
            result = self.db.table('tenders') \
                .update(tender_data) \
                .eq('id', tender_id) \
                .execute()

            if result.data:
                return tender_id, result.data[0].get('naam', '')
            else:
                logger.warning(f"Tender {tender_id} niet gevonden voor update")

        # Aanmaken nieuwe tender
        tender_data['aangemaakt_door'] = user_id
        tender_data['fase'] = 'Lopend'

        result = self.db.table('tenders') \
            .insert(tender_data) \
            .execute()

        if result.data:
            new_id = result.data[0]['id']
            naam = result.data[0].get('naam', '')
            return new_id, naam

        raise Exception("Tender aanmaken mislukt")

    def _extract_tender_fields(self, metadata: dict) -> dict:
        """
        Extracteer tender-velden uit wizard metadata.
        Handelt zowel platte als geneste structuren af.
        """
        fields = {}

        # Directe velden
        direct_mappings = {
            'naam': 'naam',
            'opdrachtgever': 'opdrachtgever',
            'referentienummer': 'referentienummer',
            'beschrijving': 'beschrijving',
            'geraamde_waarde': 'geraamde_waarde',
            'sector': 'sector',
            'procedure_type': 'procedure_type',
        }

        for src, dst in direct_mappings.items():
            val = self._get_value(metadata, src)
            if val is not None:
                fields[dst] = val

        # Datum velden
        deadline = self._get_value(metadata, 'deadline_indiening')
        if deadline:
            fields['deadline_indiening'] = str(deadline).split('T')[0]

        nvi_deadline = self._get_value(metadata, 'deadline_nvi')
        if nvi_deadline:
            fields['deadline_nvi'] = str(nvi_deadline).split('T')[0]

        publicatie = self._get_value(metadata, 'publicatiedatum')
        if publicatie:
            fields['publicatiedatum'] = str(publicatie).split('T')[0]

        return fields

    def _get_value(self, data: dict, key: str) -> Any:
        """
        Haal een waarde op uit data — ondersteunt geneste objecten
        met 'value' key (zoals extractedData uit de wizard).
        """
        if key in data:
            val = data[key]
            if isinstance(val, dict) and 'value' in val:
                return val['value']
            return val

        # Zoek in geneste categorieën (bijv. metadata.planning.deadline_indiening)
        for category_key, category in data.items():
            if isinstance(category, dict) and key in category:
                val = category[key]
                if isinstance(val, dict) and 'value' in val:
                    return val['value']
                return val

        return None

    # ══════════════════════════════════════════════
    # 2. PLANNING TAKEN
    # ══════════════════════════════════════════════

    async def _save_planning_taken(
        self,
        tender_id: str,
        planning_taken: list,
        tenderbureau_id: str
    ) -> int:
        """Sla planning taken op in planning_taken tabel."""
        if not planning_taken:
            return 0

        # Verwijder eventueel bestaande taken voor deze tender
        self.db.table('planning_taken') \
            .delete() \
            .eq('tender_id', tender_id) \
            .execute()

        rows = []
        for i, taak in enumerate(planning_taken):
            row = {
                'tender_id': tender_id,
                'tenderbureau_id': tenderbureau_id,
                'naam': taak.get('naam', f'Taak {i + 1}'),
                'datum': taak.get('datum'),
                'eind_datum': taak.get('eind_datum'),
                'rol': taak.get('rol'),
                'toegewezen_aan': taak.get('toegewezen_aan', {}).get('id') if isinstance(taak.get('toegewezen_aan'), dict) else taak.get('toegewezen_aan'),
                'is_mijlpaal': taak.get('is_mijlpaal', False),
                'volgorde': taak.get('volgorde', i),
                'status': 'open',
            }
            rows.append(row)

        if rows:
            result = self.db.table('planning_taken') \
                .insert(rows) \
                .execute()
            return len(result.data or [])

        return 0

    # ══════════════════════════════════════════════
    # 3. CHECKLIST ITEMS
    # ══════════════════════════════════════════════

    async def _save_checklist_items(
        self,
        tender_id: str,
        checklist_items: list,
        tenderbureau_id: str
    ) -> int:
        """Sla checklist items op."""
        if not checklist_items:
            return 0

        # Verwijder bestaande checklist voor deze tender
        self.db.table('checklist_items') \
            .delete() \
            .eq('tender_id', tender_id) \
            .execute()

        rows = []
        for i, item in enumerate(checklist_items):
            row = {
                'tender_id': tender_id,
                'tenderbureau_id': tenderbureau_id,
                'naam': item.get('naam', f'Item {i + 1}'),
                'datum': item.get('datum'),
                'rol': item.get('rol'),
                'toegewezen_aan': item.get('toegewezen_aan', {}).get('id') if isinstance(item.get('toegewezen_aan'), dict) else item.get('toegewezen_aan'),
                'is_verplicht': item.get('is_verplicht', True),
                'volgorde': item.get('volgorde', i),
                'status': 'open',
            }
            rows.append(row)

        if rows:
            result = self.db.table('checklist_items') \
                .insert(rows) \
                .execute()
            return len(result.data or [])

        return 0

    # ══════════════════════════════════════════════
    # 4. TEAM ASSIGNMENTS
    # ══════════════════════════════════════════════

    async def _save_team_assignments(
        self,
        tender_id: str,
        team_assignments: dict
    ) -> int:
        """
        Sla team-toewijzingen op.
        team_assignments: { rol: user_id }
        """
        if not team_assignments:
            return 0

        # Verwijder bestaande toewijzingen
        self.db.table('tender_team') \
            .delete() \
            .eq('tender_id', tender_id) \
            .execute()

        rows = []
        for rol, user_id in team_assignments.items():
            if user_id and user_id != 'niet_nodig':
                rows.append({
                    'tender_id': tender_id,
                    'user_id': user_id,
                    'rol': rol,
                })

        if rows:
            result = self.db.table('tender_team') \
                .insert(rows) \
                .execute()
            return len(result.data or [])

        return 0

    # ══════════════════════════════════════════════
    # 5. DOCUMENTEN KOPPELEN
    # ══════════════════════════════════════════════

    async def _link_documents(
        self,
        tender_id: str,
        document_ids: list
    ) -> int:
        """
        Koppel AI-gegenereerde documenten aan de tender.
        De documenten zijn al aangemaakt in Fase E,
        hier updaten we alleen de tender_id als dat nodig is.
        """
        if not document_ids:
            return 0

        count = 0
        for doc_id in document_ids:
            try:
                self.db.table('ai_generated_documents') \
                    .update({
                        'tender_id': tender_id,
                        'status': 'geaccepteerd'
                    }) \
                    .eq('id', doc_id) \
                    .execute()
                count += 1
            except Exception as e:
                logger.warning(f"Document {doc_id} koppelen mislukt: {e}")

        return count

    # ══════════════════════════════════════════════
    # 6. TENDER FASE UPDATEN
    # ══════════════════════════════════════════════

    async def _update_tender_fase(
        self,
        tender_id: str,
        planning_metadata: dict
    ) -> None:
        """
        Update de tender met planning-metadata en zet fase op 'Lopend'.
        """
        update_data = {
            'fase': 'Lopend',
        }

        # Sla planning metadata op als die er is
        if planning_metadata:
            deadline = planning_metadata.get('deadline')
            if deadline:
                update_data['deadline_indiening'] = str(deadline).split('T')[0]

            # Bewaar doorlooptijd info als JSON
            update_data['planning_metadata'] = {
                'eerste_taak': planning_metadata.get('eerste_taak'),
                'laatste_taak': planning_metadata.get('laatste_taak'),
                'doorlooptijd_werkdagen': planning_metadata.get('doorlooptijd_werkdagen'),
                'doorlooptijd_kalenderdagen': planning_metadata.get('doorlooptijd_kalenderdagen'),
                'feestdagen_overgeslagen': planning_metadata.get('feestdagen_overgeslagen', []),
            }

        try:
            self.db.table('tenders') \
                .update(update_data) \
                .eq('id', tender_id) \
                .execute()
        except Exception as e:
            logger.warning(f"Tender fase update mislukt: {e}")

    # ══════════════════════════════════════════════
    # 7. IMPORT SESSIE AFSLUITEN
    # ══════════════════════════════════════════════

    async def _close_import_session(
        self,
        import_id: str,
        tender_id: str
    ) -> None:
        """Markeer de smart import sessie als voltooid."""
        try:
            self.db.table('smart_imports') \
                .update({
                    'status': 'completed',
                    'tender_id': tender_id,
                    'completed_at': datetime.utcnow().isoformat()
                }) \
                .eq('id', import_id) \
                .execute()
        except Exception as e:
            logger.warning(f"Import sessie afsluiten mislukt: {e}")