"""
Voeg de 'Tenderplanning extractie' AI-template toe aan de database.
Run: python scripts/add_planning_extractor_template.py
"""
import os
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL en SUPABASE_SERVICE_KEY moeten in .env staan")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def add_planning_extractor_template():
    new_template = {
        "template_key": "planning_extractor",
        "naam": "Tenderplanning extractie",
        "icon": "📅",
        "beschrijving": "Extraheer automatisch een tenderplanning uit aanbestedingsdocumenten.",
        "kleur": "#6366f1",
        "required_files": [],
        "optional_files": [],
        "estimated_duration_minutes": 7,
        "requires_bedrijf_data": False,
        "requires_team_data": False,
        "volgorde": 10,
        "is_active": True,
        "is_beta": False
    }
    result = supabase.table('ai_document_templates')\
        .insert(new_template)\
        .execute()
    if result.data:
        print("✅ Template 'planning_extractor' toegevoegd!")
    else:
        print("❌ Toevoegen mislukt.")

if __name__ == "__main__":
    add_planning_extractor_template()
