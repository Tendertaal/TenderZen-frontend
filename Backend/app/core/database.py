# Backend/app/core/database.py
# Database connectie helpers — TenderZen v3.5
#
# WIJZIGINGEN v3.5 (2026-02-11):
# - NIEUW: get_supabase_with_token() — Supabase client met user JWT
#   → auth.uid() werkt correct in RLS policies
#   → Gebruik voor ALLE queries op tabellen met RLS
#
# BESTAAND:
# - get_supabase()       — Client met SUPABASE_SECRET_KEY
# - get_supabase_admin() — Service role client (omzeilt RLS)
# - get_supabase_async() — Async wrapper voor backwards compat
#
# ARCHITECTUUR:
# ┌─────────────────────────────────────────────────────────┐
# │  get_supabase_with_token(jwt)  ← NIEUW, voor endpoints │
# │  ├── apikey header = SECRET_KEY                         │
# │  └── Authorization  = Bearer {user JWT}                 │
# │      → auth.uid() = user's UUID ✅                      │
# │      → RLS policies werken correct ✅                    │
# │                                                         │
# │  get_supabase()  ← ALLEEN voor system-level operaties   │
# │  └── auth.uid() = NULL ⚠️                               │
# │                                                         │
# │  get_supabase_admin()  ← Optioneel, service_role key    │
# │  └── Omzeilt RLS volledig ⛔                             │
# └─────────────────────────────────────────────────────────┘

import os
import logging
from supabase import create_client, Client
from functools import lru_cache

from app.config import settings

logger = logging.getLogger(__name__)

# Supabase configuratie via Pydantic Settings (laadt .env automatisch)
SUPABASE_URL = settings.supabase_url
SUPABASE_SECRET_KEY = settings.supabase_secret_key

# Service role key is optioneel — kan in .env staan als SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


@lru_cache()
def get_supabase() -> Client:
    """
    Standaard Supabase client met secret key.
    
    ⚠️ LET OP: auth.uid() is NULL met deze client!
    Voor endpoint queries → gebruik get_user_db() dependency.
    """
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


@lru_cache()
def get_supabase_admin() -> Client:
    """
    Supabase admin client met service_role key.
    
    ⛔ WAARSCHUWING: Omzeilt Row Level Security volledig!
    
    Valt terug op de standaard secret key als service_role
    key niet geconfigureerd is.
    """
    key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY
    return create_client(SUPABASE_URL, key)


def get_supabase_with_token(token: str) -> Client:
    """
    Supabase client met de JWT van de ingelogde gebruiker.
    
    Dit is de JUISTE manier om Supabase te gebruiken vanuit endpoints:
    - apikey header  = SECRET_KEY (vereist door Supabase API gateway)
    - Authorization  = Bearer {user JWT}
    - auth.uid()     = user's UUID ✅
    - RLS policies   = werken correct ✅
    
    ⚠️ NIET cachen — elke request heeft een eigen token.
    
    Args:
        token: De JWT access token van de ingelogde gebruiker
    
    Returns:
        Supabase Client met user-context voor RLS
    """
    if not token:
        raise ValueError("User token is vereist voor get_supabase_with_token()")
    
    # Maak een NIEUWE client per request (niet cachen — token is user-specifiek)
    client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    
    # Stel de user JWT in als Authorization header voor PostgREST
    # Dit zorgt ervoor dat auth.uid() de juiste user UUID retourneert
    client.postgrest.auth(token)
    
    logger.debug("Supabase client aangemaakt met user token voor RLS")
    
    return client


# ─── Async variant (gebruikt door tenders.py, users.py e.a.) ───

async def get_supabase_async() -> Client:
    """
    Async wrapper — retourneert dezelfde sync Supabase client.
    Bewaard voor backwards compatibility met bestaande imports.
    
    ⚠️ Zelfde beperking als get_supabase(): auth.uid() = NULL.
    Voor endpoints met RLS → gebruik get_user_db() dependency.
    """
    return get_supabase()


# ─── Backwards compatibility aliases ───
get_supabase_client = get_supabase