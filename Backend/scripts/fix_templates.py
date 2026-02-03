"""
Fix AI Document Templates
- Update existing templates to active
- Add missing 'samenvatting' template
- Improve data quality

Run: python scripts/fix_templates.py
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL en SUPABASE_SERVICE_KEY moeten in .env staan")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fix_templates():
    """Fix existing templates and add missing ones."""
    print("🔧 Starting template fixes...")
    
    # ============================================
    # STAP 1: Activeer alle bestaande templates
    # ============================================
    print("\n📝 STAP 1: Activating existing templates...")
    
    updates = {
        'rode_draad': {
            'is_active': True,
            'is_beta': False,
            'beschrijving': 'Identificeer de rode draad in de tender en de kernwaarden van de opdrachtgever',
        },
        'offerte': {
            'is_active': True,  # ← ACTIVEREN!
            'is_beta': False,
            'beschrijving': 'Genereer een professionele offerte op basis van de tendereisen',
        },
        'versie1_inschrijving': {
            'is_active': True,  # ← ACTIVEREN!
            'is_beta': False,
            'beschrijving': 'Genereer een eerste concept van de tender inschrijving',
        }
    }
    
    for template_key, update_data in updates.items():
        print(f"\n🔄 Updating: {template_key}")
        result = supabase.table('ai_document_templates')\
            .update(update_data)\
            .eq('template_key', template_key)\
            .execute()
        
        if result.data:
            print(f"   ✅ Updated: {template_key} → is_active = TRUE")
        else:
            print(f"   ⚠️ Not found: {template_key}")
    
    # ============================================
    # STAP 2: Voeg ontbrekende template toe
    # ============================================
    print("\n📝 STAP 2: Adding missing 'samenvatting' template...")
    
    # Check if samenvatting exists
    existing = supabase.table('ai_document_templates')\
        .select('id')\
        .eq('template_key', 'samenvatting')\
        .execute()
    
    if not existing.data:
        new_template = {
            "template_key": "samenvatting",
            "naam": "Tender Samenvatting",
            "icon": "📋",
            "beschrijving": "Maak een beknopte samenvatting van de tender met kernpunten en belangrijkste eisen",
            "kleur": "#06b6d4",  # cyan
            "required_files": [],
            "optional_files": [],
            "estimated_duration_minutes": 5,
            "requires_bedrijf_data": False,
            "requires_team_data": False,
            "volgorde": 4,
            "is_active": True,
            "is_beta": False
        }
        
        result = supabase.table('ai_document_templates')\
            .insert(new_template)\
            .execute()
        
        if result.data:
            print(f"   ✅ Inserted: samenvatting")
        else:
            print(f"   ❌ Failed to insert: samenvatting")
    else:
        print(f"   ℹ️ Already exists: samenvatting (updating to active...)")
        supabase.table('ai_document_templates')\
            .update({'is_active': True, 'is_beta': False})\
            .eq('template_key', 'samenvatting')\
            .execute()
        print(f"   ✅ Updated: samenvatting → is_active = TRUE")
    
    # ============================================
    # STAP 3: Verify
    # ============================================
    print("\n✅ Fix complete! Verifying...")
    
    all_templates = supabase.table('ai_document_templates')\
        .select('template_key, naam, is_active, is_beta, volgorde')\
        .order('volgorde')\
        .execute()
    
    print(f"\n📋 Total templates: {len(all_templates.data)}")
    print(f"{'Key':<25} {'Name':<30} {'Active':<10} {'Beta':<10} {'Order':<10}")
    print("-" * 85)
    
    active_count = 0
    for t in all_templates.data:
        is_active = '✅ YES' if t['is_active'] else '❌ NO'
        is_beta = '🧪 YES' if t['is_beta'] else 'NO'
        print(f"{t['template_key']:<25} {t['naam']:<30} {is_active:<10} {is_beta:<10} {t['volgorde']:<10}")
        if t['is_active']:
            active_count += 1
    
    print("\n" + "=" * 85)
    print(f"✅ Active templates: {active_count}/{len(all_templates.data)}")
    
    if active_count == 4:
        print("\n🎉 SUCCESS! All 4 templates are now active!")
        return True
    else:
        print(f"\n⚠️ WARNING: Only {active_count} templates are active (expected 4)")
        return False

if __name__ == "__main__":
    try:
        success = fix_templates()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
