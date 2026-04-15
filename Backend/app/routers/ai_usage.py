"""
AI Usage Router — TenderZen
Toont AI token verbruik per bureau → tender → individuele calls.
Alleen toegankelijk voor super_admin gebruikers.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.core.database import get_supabase_async, get_supabase_admin
from app.core.dependencies import get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-usage", tags=["ai-usage"])


async def _check_super_admin(user_id: str) -> bool:
    """Verse DB-lookup via admin client (bypast RLS), zelfde patroon als TenderService._is_super_admin."""
    try:
        db = get_supabase_admin()
        result = db.table('users') \
            .select('is_super_admin') \
            .eq('id', user_id) \
            .single() \
            .execute()
        return result.data.get('is_super_admin', False) if result.data else False
    except Exception:
        return False


@router.get("/overzicht")
async def get_ai_usage_overzicht(
    current_user=Depends(get_current_user),
    db=Depends(get_supabase_async)
):
    """
    Haal AI token verbruik op per tender (via v_tender_ai_kosten view).
    Alleen toegankelijk voor super_admin.
    """
    if not await _check_super_admin(current_user['id']):
        raise HTTPException(status_code=403, detail="Geen toegang")

    try:
        overzicht = db.table('v_tender_ai_kosten').select('*').execute()

        tender_ids = [r['tender_id'] for r in overzicht.data if r.get('tender_id')]
        tenders_data = {}
        if tender_ids:
            tenders_result = db.table('tenders') \
                .select('id, naam, tenderbureau_id, bedrijf_id') \
                .in_('id', tender_ids) \
                .execute()
            tenders_data = {t['id']: t for t in tenders_result.data}

        bureau_ids = list({r['bureau_id'] for r in overzicht.data if r.get('bureau_id')})
        bureaus_data = {}
        if bureau_ids:
            bureaus_result = db.table('tenderbureaus') \
                .select('id, bureau_naam') \
                .in_('id', bureau_ids) \
                .execute()
            bureaus_data = {b['id']: b['bureau_naam'] for b in bureaus_result.data}

        bedrijf_ids = list({t['bedrijf_id'] for t in tenders_data.values() if t.get('bedrijf_id')})
        bedrijven_data = {}
        if bedrijf_ids:
            bedrijven_result = db.table('bedrijven') \
                .select('id, bedrijfsnaam') \
                .in_('id', bedrijf_ids) \
                .execute()
            bedrijven_data = {b['id']: b['bedrijfsnaam'] for b in bedrijven_result.data}

        for row in overzicht.data:
            tender = tenders_data.get(row.get('tender_id'), {})
            bureau_id = row.get('bureau_id')
            row['tender_naam'] = tender.get('naam', '—')
            row['bureau_naam'] = bureaus_data.get(bureau_id, '—')
            row['bedrijfsnaam'] = bedrijven_data.get(tender.get('bedrijf_id'), '—')

        return {"data": overzicht.data or []}
    except Exception as e:
        logger.error(f"❌ Fout bij ophalen AI usage overzicht: {e}")
        raise HTTPException(status_code=500, detail=f"Kon overzicht niet laden: {str(e)}")


@router.get("/calls")
async def get_ai_usage_calls(
    bureau_id: Optional[str] = None,
    tender_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_supabase_async)
):
    """
    Haal individuele AI calls op uit ai_usage_log.
    Optioneel filteren op bureau_id of tender_id.
    Alleen toegankelijk voor super_admin.
    """
    if not await _check_super_admin(current_user['id']):
        raise HTTPException(status_code=403, detail="Geen toegang")

    try:
        query = db.table('ai_usage_log') \
            .select('*') \
            .order('aangemaakt_op', desc=True)

        if bureau_id:
            query = query.eq('bureau_id', bureau_id)
        if tender_id:
            query = query.eq('tender_id', tender_id)

        result = query.execute()
        records = result.data or []

        # Verrijk records met tender_naam, bureau_naam, bedrijfsnaam
        t_ids = list({r['tender_id'] for r in records if r.get('tender_id')})
        tenders_data = {}
        if t_ids:
            t_result = db.table('tenders') \
                .select('id, naam, bedrijf_id') \
                .in_('id', t_ids) \
                .execute()
            tenders_data = {t['id']: t for t in t_result.data}

        b_ids = list({t['bedrijf_id'] for t in tenders_data.values() if t.get('bedrijf_id')})
        bedrijven_data = {}
        if b_ids:
            b_result = db.table('bedrijven') \
                .select('id, bedrijfsnaam') \
                .in_('id', b_ids) \
                .execute()
            bedrijven_data = {b['id']: b['bedrijfsnaam'] for b in b_result.data}

        bu_ids = list({r['bureau_id'] for r in records if r.get('bureau_id')})
        bureaus_data = {}
        if bu_ids:
            bu_result = db.table('tenderbureaus') \
                .select('id, bureau_naam') \
                .in_('id', bu_ids) \
                .execute()
            bureaus_data = {b['id']: b['bureau_naam'] for b in bu_result.data}

        for record in records:
            tender = tenders_data.get(record.get('tender_id'), {})
            record['tender_naam'] = tender.get('naam', '—')
            record['bureau_naam'] = bureaus_data.get(record.get('bureau_id'), '—')
            record['bedrijfsnaam'] = bedrijven_data.get(tender.get('bedrijf_id'), '—')

        return {"data": records}
    except Exception as e:
        logger.error(f"❌ Fout bij ophalen AI calls: {e}")
        raise HTTPException(status_code=500, detail=f"Kon calls niet laden: {str(e)}")
