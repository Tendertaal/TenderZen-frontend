# Backend/app/core/database.py
# Database connectie helpers
#
# VOEG DIT TOE aan je bestaande database.py, of vervang het hele bestand
# als je nog geen database.py hebt.

import os
from supabase import create_client, Client
from functools import lru_cache

# Supabase configuratie uit environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ayamyedredynntdaldlu.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


@lru_cache()
def get_supabase_client() -> Client:
    """
    Geeft de standaard Supabase client (met anon key).
    Gebruik voor normale operaties.
    """
    if not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_ANON_KEY niet geconfigureerd in environment")
    
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


@lru_cache()
def get_supabase_admin() -> Client:
    """
    Geeft de Supabase admin client (met service_role key).
    Gebruik voor operaties die admin rechten nodig hebben,
    zoals het lezen van auth.users of password_history.
    
    WAARSCHUWING: Deze client omzeilt Row Level Security!
    Gebruik alleen waar nodig.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY niet geconfigureerd in environment")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
