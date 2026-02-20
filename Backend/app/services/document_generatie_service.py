# ================================================================
# TenderZen — DocumentGeneratieService
# Backend/app/services/document_generatie_service.py
# Datum: 2026-02-09
# ================================================================
#
# Genereert AI-documenten op basis van aanbestedingstekst:
# - Go/No-Go Analyse
# - Samenvatting voor Team
# - Compliance Matrix
# - NvI Vragenlijst
# - Rode Draad Document
# - PvA Skelet
#
# Gebruikt Anthropic API (Claude) voor generatie.
# Slaat resultaten op in ai_generated_documents tabel.
# ================================================================

import json
import os
import logging
from typing import Dict, List, Optional
from datetime import datetime

import anthropic

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════
# AI MODEL CONFIGURATIE
# ════════════════════════════════════════════════

AI_MODELS = {
    'sonnet': 'claude-sonnet-4-5-20250514',
    'haiku':  'claude-haiku-4-5-20250514',
}

DEFAULT_MODEL = 'sonnet'
MAX_TOKENS = 4096

# ════════════════════════════════════════════════
# DOCUMENT TYPE CONFIGURATIE
# ════════════════════════════════════════════════

DOC_TYPES = {
    'go_no_go': {
        'label': 'Go/No-Go Analyse',
        'max_tokens': 3000,
        'response_format': 'json',
    },
    'samenvatting': {
        'label': 'Samenvatting voor Team',
        'max_tokens': 2000,
        'response_format': 'text',
    },
    'compliance_matrix': {
        'label': 'Compliance Matrix',
        'max_tokens': 4096,
        'response_format': 'json',
    },
    'nvi_vragen': {
        'label': 'NvI Vragenlijst',
        'max_tokens': 3000,
        'response_format': 'json',
    },
    'rode_draad': {
        'label': 'Rode Draad Document',
        'max_tokens': 3000,
        'response_format': 'text',
    },
    'pva_skelet': {
        'label': 'Plan van Aanpak Skelet',
        'max_tokens': 3000,
        'response_format': 'text',
    },
}

# ════════════════════════════════════════════════
# PROMPTS
# ════════════════════════════════════════════════

SYSTEM_PROMPT = """Je bent een ervaren tender-adviseur bij een Nederlands tenderbureau. 
Je schrijft professioneel, zakelijk Nederlands. Je kent de wereld van aanbestedingen, 
overheidsopdrachten, EMVI, BPKV, en de Aanbestedingswet 2012.

Belangrijke regels:
- Schrijf altijd in het Nederlands
- Gebruik formeel maar helder taalgebruik
- Wees concreet en specifiek, vermijd vage formuleringen
- Verwijs naar specifieke eisen/secties uit het document waar mogelijk
- Als je iets niet kunt afleiden uit het document, geef dat eerlijk aan
"""

PROMPTS = {
    'go_no_go': """Analyseer het volgende aanbestedingsdocument en maak een Go/No-Go analyse.

DOCUMENT:
{document_text}

BUREAU CONTEXT:
{bureau_context}

TEAM:
{team_info}

Geef je analyse als JSON (en ALLEEN JSON, geen andere tekst):
{{
    "aanbeveling": "GO" | "NO_GO" | "GO_MET_KANTTEKENINGEN",
    "score": <0-100>,
    "samenvatting": "<korte onderbouwing in 2-3 zinnen>",
    "sterke_punten": ["<punt 1>", "<punt 2>", ...],
    "risicos": ["<risico 1>", "<risico 2>", ...],
    "aandachtspunten": ["<punt 1>", ...],
    "geschatte_winkans": "laag" | "gemiddeld" | "hoog",
    "argumenten_go": ["<argument 1>", ...],
    "argumenten_no_go": ["<argument 1>", ...],
    "knock_outs": ["<eventuele knock-out criteria die we niet halen>"],
    "benodigde_referenties": ["<type referentie 1>", ...]
}}""",

    'samenvatting': """Maak een beknopte samenvatting (max 500 woorden) van deze aanbesteding,
geschikt om naar het projectteam te sturen via e-mail.

DOCUMENT:
{document_text}

TENDER INFO:
- Naam: {tender_naam}
- Opdrachtgever: {opdrachtgever}
- Deadline: {deadline}
- Geraamde waarde: {waarde}

TEAM:
{team_info}

Structuur:
1. **Wat wordt er gevraagd** (2-3 zinnen)
2. **Kernpunten en eisen** (de belangrijkste punten)
3. **Planning en belangrijke data** (deadline, NvI, etc.)
4. **Bijzonderheden / aandachtspunten** (wat valt op?)
5. **Rolverdeling** (wie doet wat op basis van het team)

Schrijf in helder, zakelijk Nederlands. Geen JSON, gewoon lopende tekst met headers.""",

    'compliance_matrix': """Analyseer het aanbestedingsdocument en maak een volledige compliance matrix.

DOCUMENT:
{document_text}

Geef een JSON array (en ALLEEN de JSON array, geen andere tekst) met alle eisen:
[
    {{
        "categorie": "Geschiktheidseisen" | "Uitsluitingsgronden" | "Gunningscriteria" | "Contracteisen" | "Procedureeisen",
        "eis_nummer": "<nummer uit document, bijv. 3.2.1>",
        "beschrijving": "<korte omschrijving van de eis>",
        "type": "knock_out" | "gunning" | "wens" | "informatie",
        "bewijsstuk": "<welk document/bewijs is nodig>",
        "gewicht_percentage": <null of percentage als gunningscriterium>,
        "status": "te_beoordelen",
        "bron_pagina": "<pagina of sectie referentie>"
    }}
]

Wees zo compleet mogelijk. Neem ALLE eisen mee, ook de vanzelfsprekende.""",

    'nvi_vragen': """Analyseer het aanbestedingsdocument en stel zinvolle vragen op 
voor de Nota van Inlichtingen (NvI).

DOCUMENT:
{document_text}

TENDER INFO:
- Naam: {tender_naam}
- Opdrachtgever: {opdrachtgever}

Geef een JSON array (en ALLEEN de JSON array) met suggesties voor NvI-vragen:
[
    {{
        "vraag_nummer": <volgnummer>,
        "onderwerp": "<kort onderwerp>",
        "vraag": "<de volledige vraag zoals je die zou indienen>",
        "reden": "<waarom deze vraag belangrijk is>",
        "prioriteit": "hoog" | "middel" | "laag",
        "referentie": "<sectie/pagina in het document>"
    }}
]

Focus op:
- Onduidelijkheden in eisen of criteria
- Tegenstrijdigheden in het document  
- Vragen die de scope verduidelijken
- Vragen over gunningscriteria en weging
- Praktische vragen over de procedure
- Strategische vragen die ons een voordeel geven""",

    'rode_draad': """Analyseer het aanbestedingsdocument en schrijf een Rode Draad Document.
Dit is de strategische basis voor het schrijven van de inschrijving.

DOCUMENT:
{document_text}

TENDER INFO:
- Naam: {tender_naam}
- Opdrachtgever: {opdrachtgever}

TEAM:
{team_info}

Schrijf het Rode Draad Document met deze structuur:

## 1. Kernboodschap
Wat is onze centrale boodschap? Wat maakt ons onderscheidend?

## 2. Wensen van de opdrachtgever
Wat wil de opdrachtgever écht? (zowel expliciet als impliciet)

## 3. Onze aanpak in het kort
Hoe gaan we het aanpakken? Wat zijn onze USP's?

## 4. Gunningscriteria strategie
Per gunningscriterium: wat is onze invalshoek?

## 5. Tone of voice
Welke toon en stijl passen bij deze opdrachtgever?

## 6. Do's en Don'ts
Concrete schrijfinstructies voor het team.

Schrijf in helder, inspirerend Nederlands. Dit document moet het team richting geven.""",

    'pva_skelet': """Analyseer het aanbestedingsdocument en maak een skelet (structuur) 
voor het Plan van Aanpak.

DOCUMENT:
{document_text}

TENDER INFO:
- Naam: {tender_naam}
- Opdrachtgever: {opdrachtgever}

Maak een compleet PvA-skelet met:

## Plan van Aanpak — {tender_naam}

### Structuur
Geef per hoofdstuk:
- Hoofdstuktitel
- Korte beschrijving van wat er in moet staan (2-3 zinnen)
- Relevante eisen uit het document die hier beantwoord worden
- Geschat aantal woorden/pagina's

### Suggesties
- Welke bijlagen zijn nodig?
- Welke visualisaties/schema's versterken het verhaal?
- Waar liggen de belangrijkste scoringskansen?

Stem de structuur af op de gunningscriteria uit het document.
Schrijf in helder Nederlands.""",
}


class DocumentGeneratieService:
    """
    Genereert AI-documenten voor tenders op basis van
    aanbestedingstekst en team-context.
    """

    def __init__(self, supabase_client):
        self.db = supabase_client
        self.ai_client = anthropic.Anthropic(
            api_key=os.getenv('ANTHROPIC_API_KEY')
        )

    # ══════════════════════════════════════════════
    # PUBLIEKE METHODES
    # ══════════════════════════════════════════════

    async def generate_documents(
        self,
        tender_id: str,
        import_id: str,
        document_types: List[str],
        team_assignments: Dict[str, str],
        tenderbureau_id: str,
        model: str = DEFAULT_MODEL
    ) -> dict:
        """
        Genereer meerdere AI-documenten voor een tender.

        Args:
            tender_id: UUID van de tender
            import_id: UUID van de smart import sessie
            document_types: Lijst van documenttypes om te genereren
            team_assignments: Mapping rol → user_id
            tenderbureau_id: UUID van het bureau
            model: AI model ('sonnet' of 'haiku')

        Returns:
            Dict met 'documents' array
        """
        logger.info(
            f"Start documentgeneratie: tender={tender_id}, "
            f"types={document_types}, model={model}"
        )

        # 1. Haal de brondata op
        tender_data = await self._get_tender_data(tender_id)
        document_text = await self._get_document_text(import_id)
        team_info = await self._get_team_info(team_assignments)
        bureau_context = await self._get_bureau_context(tenderbureau_id)

        if not document_text:
            logger.warning(f"Geen documenttekst gevonden voor import {import_id}")
            return {'documents': []}

        # 2. Valideer document types
        valid_types = [dt for dt in document_types if dt in DOC_TYPES]
        if not valid_types:
            return {'documents': []}

        # 3. Genereer elk document
        results = []
        ai_model_id = AI_MODELS.get(model, AI_MODELS[DEFAULT_MODEL])

        for doc_type in valid_types:
            try:
                doc = await self._generate_single_document(
                    doc_type=doc_type,
                    document_text=document_text,
                    tender_data=tender_data,
                    team_info=team_info,
                    bureau_context=bureau_context,
                    ai_model_id=ai_model_id,
                    model_label=model
                )

                # 4. Sla op in database
                saved = await self._save_document(
                    tender_id=tender_id,
                    doc_type=doc_type,
                    doc=doc,
                    ai_model=model
                )

                results.append(saved)

                logger.info(f"Document gegenereerd: {doc_type} (id={saved.get('id')})")

            except Exception as e:
                logger.error(f"Fout bij genereren {doc_type}: {e}", exc_info=True)
                results.append({
                    'type': doc_type,
                    'titel': DOC_TYPES[doc_type]['label'],
                    'status': 'error',
                    'error': str(e)
                })

        return {'documents': results}

    async def regenerate_document(
        self,
        document_id: str,
        tender_id: str,
        import_id: str,
        team_assignments: Dict[str, str],
        tenderbureau_id: str,
        model: str = DEFAULT_MODEL
    ) -> dict:
        """Regenereer een bestaand document."""
        # Haal bestaand document op voor type
        existing = self.db.table('ai_generated_documents') \
            .select('type') \
            .eq('id', document_id) \
            .single() \
            .execute()

        if not existing.data:
            raise ValueError(f"Document {document_id} niet gevonden")

        doc_type = existing.data['type']

        # Genereer opnieuw
        result = await self.generate_documents(
            tender_id=tender_id,
            import_id=import_id,
            document_types=[doc_type],
            team_assignments=team_assignments,
            tenderbureau_id=tenderbureau_id,
            model=model
        )

        # Verwijder het oude document
        self.db.table('ai_generated_documents') \
            .delete() \
            .eq('id', document_id) \
            .execute()

        docs = result.get('documents', [])
        return docs[0] if docs else {'error': 'Regeneratie mislukt'}

    # ══════════════════════════════════════════════
    # AI GENERATIE
    # ══════════════════════════════════════════════

    async def _generate_single_document(
        self,
        doc_type: str,
        document_text: str,
        tender_data: dict,
        team_info: str,
        bureau_context: str,
        ai_model_id: str,
        model_label: str
    ) -> dict:
        """Genereer één document via de Anthropic API."""
        config = DOC_TYPES[doc_type]
        prompt_template = PROMPTS[doc_type]

        # Bouw de prompt op met beschikbare data
        prompt = prompt_template.format(
            document_text=self._truncate_text(document_text, 12000),
            tender_naam=tender_data.get('naam', 'Onbekend'),
            opdrachtgever=tender_data.get('opdrachtgever', 'Onbekend'),
            deadline=tender_data.get('deadline_indiening', 'Onbekend'),
            waarde=tender_data.get('geraamde_waarde', 'Niet bekend'),
            team_info=team_info or 'Geen team info beschikbaar',
            bureau_context=bureau_context or 'Geen bureau context beschikbaar',
        )

        logger.debug(f"AI prompt voor {doc_type}: {len(prompt)} chars")

        # Anthropic API call
        message = self.ai_client.messages.create(
            model=ai_model_id,
            max_tokens=config['max_tokens'],
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        # Verwerk response
        raw_text = message.content[0].text

        if config['response_format'] == 'json':
            inhoud = self._parse_json_response(raw_text)
            inhoud_tekst = raw_text
        else:
            inhoud = None
            inhoud_tekst = raw_text

        # Genereer titel
        titel = self._generate_titel(
            doc_type, tender_data.get('naam', '')
        )

        # Preview (eerste 300 chars)
        preview = inhoud_tekst[:300] if inhoud_tekst else ''
        if len(inhoud_tekst or '') > 300:
            preview += '…'

        return {
            'type': doc_type,
            'titel': titel,
            'inhoud': inhoud,
            'inhoud_tekst': inhoud_tekst,
            'preview': preview,
            'ai_model': model_label,
            'status': 'concept',
            'tokens_used': {
                'input': message.usage.input_tokens,
                'output': message.usage.output_tokens
            }
        }

    # ══════════════════════════════════════════════
    # DATABASE OPERATIES
    # ══════════════════════════════════════════════

    async def _save_document(
        self,
        tender_id: str,
        doc_type: str,
        doc: dict,
        ai_model: str
    ) -> dict:
        """Sla een gegenereerd document op in de database."""
        try:
            result = self.db.table('ai_generated_documents').insert({
                'tender_id': tender_id,
                'type': doc_type,
                'titel': doc['titel'],
                'inhoud': json.dumps(doc['inhoud']) if doc['inhoud'] else None,
                'inhoud_tekst': doc.get('inhoud_tekst'),
                'ai_model': ai_model,
                'status': 'concept',
                'versie': 1,
                'metadata': json.dumps({
                    'tokens': doc.get('tokens_used'),
                    'generated_at': datetime.utcnow().isoformat()
                })
            }).execute()

            if result.data:
                saved = result.data[0]
                return {
                    'id': saved['id'],
                    'type': doc_type,
                    'titel': doc['titel'],
                    'status': 'concept',
                    'preview': doc.get('preview', ''),
                    'inhoud': doc.get('inhoud'),
                    'inhoud_tekst': doc.get('inhoud_tekst'),
                    'ai_model': ai_model,
                    'versie': 1
                }

        except Exception as e:
            logger.error(f"Fout bij opslaan document {doc_type}: {e}")

        # Fallback: retourneer zonder database ID
        return {
            'type': doc_type,
            'titel': doc['titel'],
            'status': 'concept',
            'preview': doc.get('preview', ''),
            'inhoud': doc.get('inhoud'),
            'inhoud_tekst': doc.get('inhoud_tekst'),
            'ai_model': ai_model
        }

    async def _get_tender_data(self, tender_id: str) -> dict:
        """Haal tendergegevens op."""
        try:
            result = self.db.table('tenders') \
                .select('naam, opdrachtgever, deadline_indiening, geraamde_waarde, beschrijving') \
                .eq('id', tender_id) \
                .single() \
                .execute()
            return result.data or {}
        except Exception as e:
            logger.warning(f"Tender data ophalen mislukt: {e}")
            return {}

    async def _get_document_text(self, import_id: str) -> Optional[str]:
        """
        Haal de geëxtraheerde documenttekst op van de smart import sessie.
        Dit is de tekst die tijdens stap 2 (Analyse) is geëxtraheerd.
        """
        try:
            # Zoek in smart_imports tabel naar de extracted text
            result = self.db.table('smart_imports') \
                .select('extracted_text, extracted_data') \
                .eq('id', import_id) \
                .single() \
                .execute()

            if result.data:
                # Gebruik extracted_text als dat beschikbaar is
                if result.data.get('extracted_text'):
                    return result.data['extracted_text']

                # Fallback: probeer uit extracted_data
                data = result.data.get('extracted_data')
                if isinstance(data, str):
                    data = json.loads(data)
                if isinstance(data, dict):
                    return data.get('document_text', '')

            return None
        except Exception as e:
            logger.warning(f"Document tekst ophalen mislukt: {e}")
            return None

    async def _get_team_info(self, team_assignments: Dict[str, str]) -> str:
        """Bouw team-info string op voor de AI prompt."""
        if not team_assignments:
            return 'Nog geen team samengesteld.'

        user_ids = list(set(v for v in team_assignments.values() if v))
        if not user_ids:
            return 'Nog geen teamleden toegewezen.'

        try:
            result = self.db.table('v_bureau_team') \
                .select('user_id, naam, standaard_rol, rollen') \
                .in_('user_id', user_ids) \
                .execute()

            member_map = {
                m['user_id']: m for m in (result.data or [])
            }

            lines = []
            for rol, user_id in team_assignments.items():
                member = member_map.get(user_id, {})
                naam = member.get('naam', 'Onbekend')
                lines.append(f"- {rol.title()}: {naam}")

            return '\n'.join(lines)

        except Exception as e:
            logger.warning(f"Team info ophalen mislukt: {e}")
            return 'Team info niet beschikbaar.'

    async def _get_bureau_context(self, tenderbureau_id: str) -> str:
        """Bouw bureau context string op voor de AI prompt."""
        try:
            result = self.db.table('tenderbureaus') \
                .select('naam, beschrijving, sectoren, certificeringen') \
                .eq('id', tenderbureau_id) \
                .single() \
                .execute()

            if result.data:
                bureau = result.data
                lines = [f"Bureau: {bureau.get('naam', 'Onbekend')}"]

                if bureau.get('beschrijving'):
                    lines.append(f"Profiel: {bureau['beschrijving']}")
                if bureau.get('sectoren'):
                    sectoren = bureau['sectoren']
                    if isinstance(sectoren, list):
                        lines.append(f"Sectoren: {', '.join(sectoren)}")
                if bureau.get('certificeringen'):
                    certs = bureau['certificeringen']
                    if isinstance(certs, list):
                        lines.append(f"Certificeringen: {', '.join(certs)}")

                return '\n'.join(lines)

            return 'Geen bureau context beschikbaar.'

        except Exception as e:
            logger.warning(f"Bureau context ophalen mislukt: {e}")
            return 'Bureau context niet beschikbaar.'

    # ══════════════════════════════════════════════
    # HELPERS
    # ══════════════════════════════════════════════

    def _parse_json_response(self, text: str) -> object:
        """
        Parse JSON uit AI response. Handelt markdown code blocks af.
        """
        cleaned = text.strip()

        # Strip markdown code fences
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]

        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse fout: {e}")
            # Retourneer als raw text wrapper
            return {'raw_text': text, 'parse_error': str(e)}

    def _truncate_text(self, text: str, max_chars: int) -> str:
        """Truncate tekst op woordgrens."""
        if not text or len(text) <= max_chars:
            return text or ''

        truncated = text[:max_chars]
        # Zoek laatste spatie om op woordgrens te knippen
        last_space = truncated.rfind(' ')
        if last_space > max_chars * 0.8:
            truncated = truncated[:last_space]

        return truncated + '\n\n[... tekst ingekort voor analyse ...]'

    def _generate_titel(self, doc_type: str, tender_naam: str) -> str:
        """Genereer een titel voor het document."""
        config = DOC_TYPES.get(doc_type, {})
        label = config.get('label', doc_type)

        if tender_naam:
            return f"{label} — {tender_naam}"
        return label
