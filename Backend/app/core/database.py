"""
Supabase Database Client
"""
from supabase import create_client, Client
from app.config import settings

# Global Supabase client
_supabase_client: Client = None


def get_supabase() -> Client:
    """
    Get or create Supabase client.
    Returns a singleton instance.
    """
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_secret_key
        )
    
    return _supabase_client


async def get_supabase_async() -> Client:
    """
    Async version for FastAPI dependencies.
    """
    return get_supabase()


# Test connection
def test_connection():
    """Test database connection"""
    try:
        client = get_supabase()
        # Simple query to test connection
        result = client.table('bedrijven').select('id').limit(1).execute()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


if __name__ == "__main__":
    test_connection()
