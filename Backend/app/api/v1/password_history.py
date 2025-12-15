# Backend/app/api/v1/password_history.py
# API Endpoint voor Password History Check
#
# Dit endpoint wordt aangeroepen door de frontend VOORDAT het wachtwoord
# wordt gewijzigd via Supabase Auth.

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from ...services.password_service import password_service
from ...core.dependencies import get_current_user

router = APIRouter(prefix="/password", tags=["Password"])


class ValidatePasswordRequest(BaseModel):
    """Request body voor wachtwoord validatie."""
    new_password: str


class ValidatePasswordResponse(BaseModel):
    """Response voor wachtwoord validatie."""
    allowed: bool
    message: str


async def get_user_id_from_token(authorization: str = Header(...)) -> str:
    """
    Haal user_id op uit de Supabase JWT token.
    """
    from ...core.database import get_supabase_admin
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Ongeldige autorisatie header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        supabase = get_supabase_admin()
        user_response = supabase.auth.get_user(token)
        
        if user_response and user_response.user:
            return str(user_response.user.id)
        else:
            raise HTTPException(status_code=401, detail="Ongeldige sessie")
    except Exception as e:
        print(f"❌ Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Ongeldige sessie")


@router.post("/validate", response_model=ValidatePasswordResponse)
async def validate_and_prepare_password(
    request: ValidatePasswordRequest,
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Valideer nieuw wachtwoord en bereid wijziging voor.
    
    Dit endpoint:
    1. Checkt of nieuw wachtwoord != huidig wachtwoord
    2. Checkt of nieuw wachtwoord niet in history staat (laatste 5)
    3. Als OK: slaat HUIDIG wachtwoord op in history (wordt "oud")
    
    De frontend roept dit aan VOORDAT Supabase auth.updateUser wordt aangeroepen.
    """
    
    if not request.new_password:
        raise HTTPException(status_code=400, detail="Nieuw wachtwoord is verplicht")
    
    # Valideer wachtwoord en bereid voor
    allowed, message = await password_service.validate_and_prepare(
        user_id=user_id,
        new_password=request.new_password
    )
    
    return ValidatePasswordResponse(
        allowed=allowed,
        message=message
    )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "password-history"}