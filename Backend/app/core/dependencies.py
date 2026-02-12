"""
FastAPI Dependencies — TenderZen v3.5
Bevat authenticatie, autorisatie en database dependencies.

WIJZIGINGEN v3.5 (2026-02-11):
- NIEUW: get_user_db() — Supabase client met user JWT voor RLS
  → Vervangt get_supabase() in alle endpoint queries
  → auth.uid() werkt correct in RLS policies
  → FastAPI cached credentials per request (geen dubbele extractie)

WIJZIGINGEN v3.4:
- get_current_user bevat nu is_super_admin flag
- Super-admin krijgt tenderbureau_id = None (moet uit request komen)

INSTALLATIE:
1. Kopieer naar Backend/app/core/dependencies.py
2. Zorg dat app/core/database.py ook v3.5 is (met get_supabase_with_token)
3. Zorg dat app/core/bureau_context.py geïnstalleerd is
"""

from typing import Optional
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from app.core.database import get_supabase, get_supabase_with_token
from app.core.security import decode_access_token

import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()


# ═══════════════════════════════════════════════════════════════
# 1. AUTHENTICATIE — User identity
# ═══════════════════════════════════════════════════════════════

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Get current authenticated user from JWT token + database lookup.
    
    SECURITY v3.4:
    - Bevat is_super_admin flag uit users tabel
    - Super-admin: tenderbureau_id wordt op None gezet
      → Bureau context MOET uit de request komen
    - Normale user: tenderbureau_id uit profiel (ongewijzigd)
    
    v3.5: Slaat ook _jwt_token op voor get_user_db()
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Database lookup voor volledige user data
    # ⚠️ Hier gebruiken we get_supabase() (anon) omdat de user
    # lookup in get_current_user een bootstrap-operatie is.
    # De 'gebruikers' tabel moet accessible zijn met anon key
    # OF via een permissive RLS policy voor authenticated users.
    db = get_supabase()
    try:
        result = db.table('gebruikers') \
            .select('*') \
            .eq('id', user_id) \
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        user = result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User lookup mislukt: {e}")
        # Fallback: gebruik JWT payload
        user = {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated"),
            "is_super_admin": False,
            "tenderbureau_id": None
        }

    # ═══════════════════════════════════════════════════════════
    # ⭐ SUPER-ADMIN HANDLING (v3.4)
    # ═══════════════════════════════════════════════════════════
    # Super-admins zijn systeembeheerders die BOVEN de bureaus staan.
    # Hun tenderbureau_id wordt op None gezet zodat endpoints
    # GEDWONGEN worden om bureau-context uit de request te halen.
    # ═══════════════════════════════════════════════════════════
    
    user_is_super = user.get('is_super_admin', False) is True
    user['is_super_admin'] = user_is_super
    
    if user_is_super:
        user['_original_tenderbureau_id'] = user.get('tenderbureau_id')
        user['tenderbureau_id'] = None
        logger.debug(f"Super-admin gedetecteerd: {user.get('email')} — tenderbureau_id genulled")

    # ⭐ v3.5: Bewaar JWT token voor get_user_db()
    user['_jwt_token'] = token

    return user


# ═══════════════════════════════════════════════════════════════
# 2. DATABASE — User-scoped Supabase client
# ═══════════════════════════════════════════════════════════════

async def get_user_db(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Client:
    """
    Supabase client met de JWT van de ingelogde gebruiker.
    
    Dit zorgt ervoor dat auth.uid() correct werkt in RLS policies.
    Gebruik als Depends() in ALLE endpoints die tabellen met RLS queryen.
    
    FastAPI cached de `security` dependency per request, dus het token
    wordt maar één keer geëxtraheerd, ook als get_current_user én
    get_user_db allebei in dezelfde endpoint zitten.
    
    Voorbeeld:
        @router.get("/team-members")
        async def get_team_members(
            current_user: dict = Depends(get_current_user),
            db: Client = Depends(get_user_db)       # ← RLS-compatible
        ):
            result = db.table('team_members').select('*').execute()
            # auth.uid() = user's UUID → RLS filtert correct
    """
    token = credentials.credentials
    return get_supabase_with_token(token)


# ═══════════════════════════════════════════════════════════════
# 3. AUTORISATIE — Role checks
# ═══════════════════════════════════════════════════════════════

async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
):
    """Verify user is active."""
    if not current_user.get('actief', True) and not current_user.get('is_active', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is gedeactiveerd"
        )
    return current_user


async def require_super_admin(
    current_user: dict = Depends(get_current_user)
):
    """Dependency die alleen super-admins doorlaat."""
    if not current_user.get('is_super_admin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin rechten vereist"
        )
    return current_user