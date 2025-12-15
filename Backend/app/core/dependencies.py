"""
FastAPI Dependencies
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get current authenticated user from JWT token.
    No database lookup needed - user info is in the token.
    """
    print("🔐 get_current_user called")
    
    token = credentials.credentials
    print(f"🎫 Token received: {token[:50]}...")
    
    payload = decode_access_token(token)
    print(f"📋 Payload result: {payload}")
    
    if payload is None:
        print("❌ Payload is None - token invalid")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        print("❌ No user_id in payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    print(f"✅ User authenticated: {user_id}")
    
    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role", "authenticated")
    }


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """
    Verify user is active.
    """
    return current_user