# ================================================================
# TenderZen — Profile Router
# Backend/app/routers/profile_router.py
# Datum: 2026-02-11 (v1.0)
# ================================================================
#
# Endpoints:
# - GET  /api/v1/profile         → Haal profiel op van ingelogde user
# - PUT  /api/v1/profile         → Update profiel van ingelogde user
# - GET  /api/v1/profile/bureaus → Bureau-toegang overzicht
# - GET  /api/v1/profile/stats   → Platform statistieken (super-admin)
# ================================================================

import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Profile"])


# ════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════

class ProfileUpdateRequest(BaseModel):
    naam: Optional[str] = None
    email: Optional[str] = None
    telefoon: Optional[str] = None
    functie: Optional[str] = None
    organisatie: Optional[str] = None
    avatar_kleur: Optional[str] = None


# ════════════════════════════════════════════════
# 1. GET PROFILE
# ════════════════════════════════════════════════

@router.get("/profile", summary="Haal profiel op van ingelogde gebruiker")
async def get_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Retourneert het volledige profiel inclusief:
    - Persoonlijke gegevens
    - Super-admin status
    - MFA status
    - Bureau-koppelingen
    """
    db = get_supabase()
    user_id = current_user.get('id')

    try:
        # Haal user data op
        user_result = db.table('users').select(
            'id, email, naam, telefoon, functie, organisatie, '
            'avatar_kleur, initialen, is_super_admin, mfa_required, '
            'created_at, updated_at'
        ).eq('id', user_id).single().execute()

        if not user_result.data:
            raise HTTPException(status_code=404, detail="Profiel niet gevonden")

        user = user_result.data
        is_super = user.get('is_super_admin', False) is True

        # Haal bureau-koppelingen op
        bureaus = []
        if is_super:
            # Super-admin: toon alle bureaus
            bureau_result = db.table('tenderbureaus').select(
                'id, naam'
            ).execute()
            for bureau in (bureau_result.data or []):
                # Tel teamleden en tenders per bureau
                team_count = db.table('v_bureau_team').select(
                    'user_id', count='exact'
                ).eq('tenderbureau_id', bureau['id']).execute()

                tender_count = db.table('tenders').select(
                    'id', count='exact'
                ).eq('tenderbureau_id', bureau['id']).execute()

                bureaus.append({
                    'bureau_id': bureau['id'],
                    'bureau_naam': bureau['naam'],
                    'role': 'super-admin',
                    'is_active': True,
                    'team_count': team_count.count if team_count.count else 0,
                    'tender_count': tender_count.count if tender_count.count else 0
                })
        else:
            # Normale user: toon eigen bureau-koppelingen
            access_result = db.table('user_bureau_access').select(
                'tenderbureau_id, role, is_active, tenderbureaus(naam)'
            ).eq('user_id', user_id).eq('is_active', True).execute()

            for access in (access_result.data or []):
                bureau_id = access.get('tenderbureau_id')
                bureau_naam = access.get('tenderbureaus', {}).get('naam', 'Onbekend')

                tender_count = db.table('tenders').select(
                    'id', count='exact'
                ).eq('tenderbureau_id', bureau_id).execute()

                bureaus.append({
                    'bureau_id': bureau_id,
                    'bureau_naam': bureau_naam,
                    'role': access.get('role', 'viewer'),
                    'is_active': access.get('is_active', True),
                    'tender_count': tender_count.count if tender_count.count else 0
                })

        # MFA status ophalen via Supabase Auth (als beschikbaar)
        mfa_active = False
        try:
            # Check of user MFA factors heeft
            factors_result = db.table('mfa_factors').select(
                'id'
            ).eq('user_id', user_id).eq('status', 'verified').execute()
            mfa_active = bool(factors_result.data)
        except Exception:
            # mfa_factors tabel bestaat mogelijk niet of is niet toegankelijk
            # Fallback: gebruik mfa_required veld als indicator
            mfa_active = user.get('mfa_required', False)

        # Bouw response
        profile = {
            'id': user['id'],
            'email': user.get('email'),
            'naam': user.get('naam'),
            'telefoon': user.get('telefoon'),
            'functie': user.get('functie'),
            'organisatie': user.get('organisatie'),
            'avatar_kleur': user.get('avatar_kleur'),
            'initialen': user.get('initialen'),
            'is_super_admin': is_super,
            'mfa_active': mfa_active,
            'mfa_required': user.get('mfa_required', False),
            'created_at': user.get('created_at'),
            'updated_at': user.get('updated_at'),
            'bureaus': bureaus,
            'bureau_count': len(bureaus),
            'total_tenders': sum(b.get('tender_count', 0) for b in bureaus)
        }

        return {"success": True, "data": profile}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij ophalen profiel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij ophalen profiel")


# ════════════════════════════════════════════════
# 2. UPDATE PROFILE
# ════════════════════════════════════════════════

@router.put("/profile", summary="Update profiel van ingelogde gebruiker")
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update de persoonlijke gegevens van de ingelogde gebruiker."""
    db = get_supabase()
    user_id = current_user.get('id')

    try:
        # Filter lege velden
        update_data = {
            k: v for k, v in request.model_dump().items()
            if v is not None
        }

        if not update_data:
            raise HTTPException(status_code=400, detail="Geen velden om te updaten")

        # Genereer initialen als naam wijzigt
        if 'naam' in update_data:
            naam = update_data['naam']
            parts = naam.strip().split()
            if len(parts) >= 2:
                update_data['initialen'] = (parts[0][0] + parts[-1][0]).upper()
            elif len(parts) == 1:
                update_data['initialen'] = parts[0][:2].upper()

        result = db.table('users').update(update_data).eq('id', user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Profiel niet gevonden")

        logger.info(f"✅ Profiel bijgewerkt voor {current_user.get('email')}: {list(update_data.keys())}")

        return {
            "success": True,
            "data": result.data[0],
            "message": "Profiel bijgewerkt"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij updaten profiel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij updaten profiel")


# ════════════════════════════════════════════════
# 3. PLATFORM STATS (Super-Admin Only)
# ════════════════════════════════════════════════

@router.get("/profile/stats", summary="Platform statistieken (super-admin)")
async def get_platform_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Retourneert platform-brede statistieken.
    Alleen beschikbaar voor super-admins.
    """
    is_super = current_user.get('is_super_admin', False) is True

    # Fallback: eigen DB check als get_current_user is_super_admin niet meestuurt
    if not is_super:
        db = get_supabase()
        try:
            user_check = db.table('users').select('is_super_admin').eq('id', current_user.get('id')).single().execute()
            is_super = user_check.data and user_check.data.get('is_super_admin', False) is True
        except Exception:
            pass

    if not is_super:
        raise HTTPException(status_code=403, detail="Alleen super-admins")

    db = get_supabase()

    try:
        bureau_count = db.table('tenderbureaus').select('id', count='exact').execute()
        user_count = db.table('users').select('id', count='exact').execute()
        tender_count = db.table('tenders').select('id', count='exact').execute()

        return {
            "success": True,
            "data": {
                "bureaus": bureau_count.count or 0,
                "users": user_count.count or 0,
                "tenders": tender_count.count or 0
            }
        }

    except Exception as e:
        logger.error(f"Fout bij ophalen platform stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij ophalen statistieken")
