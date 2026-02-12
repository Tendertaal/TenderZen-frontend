"""
Bureau Context Resolution — Centraal beveiligingslaag
TenderZen v3.4

Bepaalt de juiste tenderbureau_id voor elke API call op basis van:
- Normale user: bureau uit profiel (user_bureau_access)
- Super-admin: bureau uit request parameter (NOOIT uit profiel)

SECURITY PRINCIPES:
1. Super-admin heeft GEEN eigen bureau — context komt uit de request
2. Zonder bureau-context → lege data of foutmelding, NOOIT alle data
3. Elke endpoint die bureau-specifieke data ophaalt MOET deze helper gebruiken
4. Fallback naar "alle data" is VERBODEN

INSTALLATIE:
1. Kopieer naar Backend/app/core/bureau_context.py
2. Importeer in endpoints:
   from app.core.bureau_context import resolve_bureau_id
"""

from typing import Optional
from fastapi import HTTPException, Query
import logging

logger = logging.getLogger(__name__)


async def resolve_bureau_id(
    current_user: dict,
    explicit_bureau_id: Optional[str] = None,
    tender_id: Optional[str] = None,
    db=None,
    required: bool = True
) -> Optional[str]:
    """
    Bepaal de juiste tenderbureau_id voor een API call.
    
    Prioriteit:
    1. explicit_bureau_id (query parameter) — altijd vertrouwen
    2. tender_id → opzoeken in tenders tabel
    3. current_user profiel — ALLEEN voor normale users
    4. user_bureau_access fallback — ALLEEN voor normale users
    
    Args:
        current_user: Dict met user data (uit get_current_user)
        explicit_bureau_id: Bureau ID meegegeven als query param
        tender_id: Optioneel tender ID om bureau van af te leiden
        db: Supabase client (nodig voor lookups)
        required: Als True, gooi exception als geen bureau gevonden
        
    Returns:
        tenderbureau_id string, of None als niet gevonden en required=False
        
    Raises:
        HTTPException 400 als required=True en geen bureau context
    """
    is_super_admin = current_user.get('is_super_admin', False)
    user_id = current_user.get('id') or current_user.get('sub')
    
    # ── 1. Expliciet meegegeven (query param / header) ──
    if explicit_bureau_id:
        logger.debug(f"Bureau via parameter: {explicit_bureau_id}")
        return explicit_bureau_id
    
    # ── 2. Afleiden van tender ──
    if tender_id and db:
        try:
            result = db.table('tenders') \
                .select('tenderbureau_id') \
                .eq('id', tender_id) \
                .limit(1) \
                .execute()
            if result.data and result.data[0].get('tenderbureau_id'):
                bureau_id = result.data[0]['tenderbureau_id']
                logger.debug(f"Bureau via tender {tender_id}: {bureau_id}")
                return bureau_id
        except Exception as e:
            logger.warning(f"Tender lookup mislukt voor {tender_id}: {e}")
    
    # ── 3. Super-admin: NOOIT automatisch een bureau toewijzen ──
    if is_super_admin:
        if required:
            logger.warning(
                f"⛔ SECURITY: Super-admin {user_id} riep endpoint aan zonder bureau context"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    "Bureau context vereist voor super-admin. "
                    "Stuur tenderbureau_id mee als query parameter."
                )
            )
        return None
    
    # ── 4. Normale user: bureau uit profiel ──
    bureau_id = current_user.get('tenderbureau_id')
    if bureau_id:
        logger.debug(f"Bureau via user profiel: {bureau_id}")
        return bureau_id
    
    # ── 5. Fallback: user_bureau_access ──
    if user_id and db:
        try:
            result = db.table('user_bureau_access') \
                .select('tenderbureau_id') \
                .eq('user_id', user_id) \
                .eq('is_active', True) \
                .limit(1) \
                .execute()
            if result.data:
                bureau_id = result.data[0]['tenderbureau_id']
                logger.debug(f"Bureau via user_bureau_access: {bureau_id}")
                return bureau_id
        except Exception as e:
            logger.warning(f"user_bureau_access lookup mislukt: {e}")
    
    # ── 6. Niets gevonden ──
    if required:
        logger.error(f"⛔ Geen bureau context voor user {user_id}")
        raise HTTPException(
            status_code=400,
            detail="Geen bureau context beschikbaar"
        )
    return None


def is_super_admin(current_user: dict) -> bool:
    """Check of de huidige gebruiker een super-admin is."""
    return current_user.get('is_super_admin', False) is True


async def validate_bureau_access(
    current_user: dict,
    bureau_id: str,
    db=None
) -> bool:
    """
    Valideer dat een user toegang heeft tot een specifiek bureau.
    
    Super-admin: altijd True (heeft toegang tot alles)
    Normale user: check user_bureau_access
    """
    if is_super_admin(current_user):
        return True
    
    user_id = current_user.get('id') or current_user.get('sub')
    if not user_id or not db:
        return False
    
    try:
        result = db.table('user_bureau_access') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('tenderbureau_id', bureau_id) \
            .eq('is_active', True) \
            .limit(1) \
            .execute()
        return bool(result.data)
    except Exception:
        return False