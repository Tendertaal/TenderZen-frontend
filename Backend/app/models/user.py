"""
User data models
"""
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user model"""
    email: EmailStr
    naam: str


class UserCreate(UserBase):
    """Model for creating a user"""
    wachtwoord: str


class UserLogin(BaseModel):
    """Model for user login"""
    email: EmailStr
    wachtwoord: str


class UserResponse(UserBase):
    """Model for user response"""
    id: int
    rol: str
    bedrijf_id: Optional[int] = None
    actief: bool = True
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
