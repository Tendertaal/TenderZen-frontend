"""
Tender API endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user
from app.models.tender import TenderCreate, TenderUpdate, TenderResponse
from app.services.tender_service import TenderService

router = APIRouter(prefix="/tenders", tags=["tenders"])


@router.get("", response_model=List[TenderResponse])
async def get_tenders(
    tenderbureau_id: Optional[str] = Query(None, description="ID van het bureau, of None voor alle bureaus (super_admin only)"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Get all tenders for current user or all bureaus (super_admin only)"""
    print(f"📱 GET /tenders for user: {current_user['id']} | tenderbureau_id={tenderbureau_id}")
    service = TenderService(db)
    is_super = await service._is_super_admin(current_user['id'])
    if tenderbureau_id is None and is_super:
        print("⭐ Super_admin requesting ALL tenders")
        return await service.get_all_tenders_all_bureaus(current_user['id'])
    elif tenderbureau_id is None and not is_super:
        # Niet toegestaan
        raise HTTPException(status_code=403, detail="Alleen super_admins mogen alle tenders opvragen.")
    else:
        return await service.get_all_tenders(current_user['id'], tenderbureau_id)


@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Get a specific tender"""
    service = TenderService(db)
    tender = await service.get_tender_by_id(tender_id, current_user['id'])
    
    if not tender:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )
    
    return tender


@router.post("", response_model=TenderResponse, status_code=status.HTTP_201_CREATED)
async def create_tender(
    tender: TenderCreate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Create a new tender"""
    print(f"➕ Creating tender for user: {current_user['id']}")
    print(f"📝 Tender data received: {tender}")
    service = TenderService(db)
    new_tender = await service.create_tender(tender, current_user['id'])
    return new_tender


@router.put("/{tender_id}", response_model=TenderResponse)
async def update_tender(
    tender_id: str,
    tender: TenderUpdate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Update a tender"""
    service = TenderService(db)
    updated_tender = await service.update_tender(
        tender_id, 
        tender, 
        current_user['id']
    )
    
    if not updated_tender:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )
    
    return updated_tender


@router.delete("/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tender(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Delete a tender"""
    service = TenderService(db)
    success = await service.delete_tender(tender_id, current_user['id'])
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender not found"
        )