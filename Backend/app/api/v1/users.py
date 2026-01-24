"""
User-related API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict
from supabase import Client

from app.core.dependencies import get_current_user
from app.core.database import get_supabase_async

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
) -> Dict:
    """Return user info with real data from database."""
    try:
        user_id = current_user.get('id')
        
        print(f"📡 Getting user info for: {user_id}")
        
        # Get real user data from database
        result = db.table('users').select('''
            *,
            tenderbureaus(naam, slug)
        ''').eq('id', user_id).single().execute()
        
        if not result.data:
            print(f"⚠️ User {user_id} not found in database, returning fallback")
            # Fallback if user not in database yet
            return {
                'id': user_id,
                'naam': current_user.get('email'),
                'email': current_user.get('email'),
                'role': current_user.get('role', 'authenticated'),
                'is_super_admin': False,
                'tenderbureau_id': None
            }
        
        user_data = result.data
        
        # Flatten tenderbureau data
        if 'tenderbureaus' in user_data and user_data['tenderbureaus']:
            user_data['tenderbureau_naam'] = user_data['tenderbureaus'].get('naam')
            user_data['tenderbureau_slug'] = user_data['tenderbureaus'].get('slug')
            del user_data['tenderbureaus']
        
        print(f"✅ User data loaded: {user_data.get('email')}, bureau: {user_data.get('tenderbureau_id')}")
        
        return user_data
        
    except Exception as e:
        print(f"❌ Error getting user info: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback on error
        return {
            'id': current_user.get('id'),
            'naam': current_user.get('email'),
            'email': current_user.get('email'),
            'role': current_user.get('role', 'authenticated'),
            'is_super_admin': False,
            'tenderbureau_id': None
        }