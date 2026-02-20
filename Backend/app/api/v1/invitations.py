"""
Team Invitations API endpoints
Gebruikt bestaande bureau_invites tabel
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import Client
from datetime import datetime, timedelta
import uuid

from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user


router = APIRouter(prefix="/invitations", tags=["invitations"])


# =====================================================
# PYDANTIC MODELS
# =====================================================

class InvitationCreate(BaseModel):
    """Create a new invitation"""
    team_member_id: str
    email: EmailStr
    role: str = "schrijver"
    personal_message: Optional[str] = None


class InvitationResponse(BaseModel):
    """Invitation response"""
    id: str
    team_member_id: Optional[str]
    email: str
    tenderbureau_id: str
    role: str
    status: str
    invite_token: str
    invited_by: str
    personal_message: Optional[str]
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime]


class BulkInviteRequest(BaseModel):
    """Bulk invite multiple team members"""
    team_member_ids: List[str]
    role: str = "schrijver"


# =====================================================
# HELPER FUNCTIONS
# =====================================================

async def check_user_can_invite(db: Client, user_id: str, tenderbureau_id: str) -> bool:
    """Check if user has permission to send invitations (admin or manager)"""
    # Check super_admin
    user_result = db.table('users')\
        .select('is_super_admin')\
        .eq('id', user_id)\
        .execute()
    
    if user_result.data and user_result.data[0].get('is_super_admin'):
        return True
    
    # Check bureau role
    result = db.table('user_bureau_access')\
        .select('role')\
        .eq('user_id', user_id)\
        .eq('tenderbureau_id', tenderbureau_id)\
        .eq('is_active', True)\
        .execute()
    
    if not result.data:
        return False
    
    role = result.data[0].get('role')
    return role in ('admin', 'manager')


async def get_user_info(db: Client, user_id: str) -> dict:
    """Get user's name and email"""
    result = db.table('users')\
        .select('naam, email')\
        .eq('id', user_id)\
        .execute()
    
    if result.data:
        return result.data[0]
    return {'naam': 'Unknown', 'email': ''}


# =====================================================
# API ENDPOINTS
# =====================================================

@router.post("/send", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    invitation: InvitationCreate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Send an invitation to a team member.
    Requires admin or manager role.
    """
    user_id = current_user['id']
    
    # Get team member details
    team_member = db.table('team_members')\
        .select('*, tenderbureaus(naam)')\
        for user_id in request.team_member_ids:
            try:
                user = db.table('users')\
                    .select('id, email, naam')\
                    .eq('id', user_id)\
                    .execute()
                if not user.data:
                    results['failed'].append({
                        'id': user_id,
                        'reason': 'Not found'
                    })
                    continue
                member = user.data[0]
                if not member.get('email'):
                    results['failed'].append({
                        'id': user_id,
                        'naam': member['naam'],
                        'reason': 'No email address'
                    })
                    continue
                # Check user_bureau_access for invitation status
                access = db.table('user_bureau_access')\
                    .select('invitation_status')\
                    .eq('user_id', user_id)\
                    .eq('tenderbureau_id', current_user.get('tenderbureau_id'))\
                    .execute()
                if access.data and access.data[0].get('invitation_status') in ('pending', 'accepted'):
                    results['skipped'].append({
                        'id': user_id,
                        'naam': member['naam'],
                        'reason': f"Already {access.data[0].get('invitation_status')}"
                    })
                    continue
                # Check permission
                can_invite = await check_user_can_invite(db, current_user['id'], current_user.get('tenderbureau_id'))
                if not can_invite:
                    results['failed'].append({
                        'id': user_id,
                        'naam': member['naam'],
                        'reason': 'No permission'
                    })
                    continue
                invite_token = str(uuid.uuid4())
                expires_at = datetime.utcnow() + timedelta(days=7)
                invitation_data = {
                    'tenderbureau_id': current_user.get('tenderbureau_id'),
                    'invited_by': current_user['id'],
                    'email': member['email'],
                    'role': request.role,
                    'invite_token': invite_token,
                    'status': 'pending',
                    'expires_at': expires_at.isoformat(),
                    'user_id': user_id
                }
                db.table('bureau_invites').insert(invitation_data).execute()
                db.table('user_bureau_access')\
                    .update({
                        'invitation_status': 'pending',
                        'invited_at': datetime.utcnow().isoformat()
                    })\
                    .eq('user_id', user_id)\
                    .eq('tenderbureau_id', current_user.get('tenderbureau_id'))\
                    .execute()
                results['sent'].append({
                    'id': user_id,
                    'naam': member['naam'],
                    'email': member['email']
                })
            except Exception as e:
                results['failed'].append({
                    'id': user_id,
                    'reason': str(e)
                })
    #     inviter_name=inviter_info['naam'],
    #     personal_message=invitation.personal_message
    # )
    
    return created_invitation


@router.post("/send-bulk", status_code=status.HTTP_201_CREATED)
async def send_bulk_invitations(
    request: BulkInviteRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Send invitations to multiple team members at once.
    """
    user_id = current_user['id']
    results = {
        'sent': [],
        'failed': [],
        'skipped': []
    }
    
    for team_member_id in request.team_member_ids:
        try:
            # Get team member
            team_member = db.table('team_members')\
                .select('id, email, naam, tenderbureau_id, invitation_status')\
                .eq('id', team_member_id)\
                .execute()
            
            if not team_member.data:
                results['failed'].append({
                    'id': team_member_id,
                    'reason': 'Not found'
                })
                continue
            
            member = team_member.data[0]
            
            # Skip if no email
            if not member.get('email'):
                results['failed'].append({
                    'id': team_member_id,
                    'naam': member['naam'],
                    'reason': 'No email address'
                })
                continue
            
            # Skip if already invited or accepted
            if member['invitation_status'] in ('pending', 'accepted'):
                results['skipped'].append({
                    'id': team_member_id,
                    'naam': member['naam'],
                    'reason': f"Already {member['invitation_status']}"
                })
                continue
            
            # Check permission
            can_invite = await check_user_can_invite(db, user_id, member['tenderbureau_id'])
            if not can_invite:
                results['failed'].append({
                    'id': team_member_id,
                    'naam': member['naam'],
                    'reason': 'No permission'
                })
                continue
            
            # Create invitation
            invite_token = str(uuid.uuid4())
            expires_at = datetime.utcnow() + timedelta(days=7)
            
            invitation_data = {
                'tenderbureau_id': member['tenderbureau_id'],
                'invited_by': user_id,
                'email': member['email'],
                'role': request.role,
                'invite_token': invite_token,
                'status': 'pending',
                'expires_at': expires_at.isoformat(),
                'team_member_id': team_member_id
            }
            
            db.table('bureau_invites').insert(invitation_data).execute()
            
            # Update team member
            db.table('team_members')\
                .update({
                    'invitation_status': 'pending',
                    'invited_at': datetime.utcnow().isoformat()
                })\
                .eq('id', team_member_id)\
                .execute()
            
            results['sent'].append({
                'id': team_member_id,
                'naam': member['naam'],
                'email': member['email']
            })
            
        except Exception as e:
            results['failed'].append({
                'id': team_member_id,
                'reason': str(e)
            })
    
    print(f"📧 Bulk invite: {len(results['sent'])} sent, {len(results['skipped'])} skipped, {len(results['failed'])} failed")
    
    return results


@router.get("/pending/{tenderbureau_id}")
async def get_pending_invitations(
    tenderbureau_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Get all pending invitations for a tenderbureau.
    """
    user_id = current_user['id']
    
    # Check permission
    can_invite = await check_user_can_invite(db, user_id, tenderbureau_id)
    if not can_invite:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view invitations"
        )
    
    result = db.table('bureau_invites')\
        .select('*, team_members(naam)')\
        .eq('tenderbureau_id', tenderbureau_id)\
        .eq('status', 'pending')\
        .order('created_at', desc=True)\
        .execute()
    
    return result.data


@router.get("/verify/{token}")
async def verify_invitation(
    token: str,
    db: Client = Depends(get_supabase_async)
):
    """
    Verify an invitation token (public endpoint for accept page).
    Returns invitation details if valid.
    """
    result = db.table('bureau_invites')\
        .select('*, team_members(naam), tenderbureaus(naam), users!invited_by(naam)')\
        .eq('invite_token', token)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token"
        )
    
    invitation = result.data[0]
    
    # Check if expired
    expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
    if expires_at < datetime.now(expires_at.tzinfo):
        # Update status to expired
        db.table('bureau_invites')\
            .update({'status': 'expired'})\
            .eq('id', invitation['id'])\
            .execute()
        
        if invitation.get('team_member_id'):
            db.table('team_members')\
                .update({'invitation_status': 'expired'})\
                .eq('id', invitation['team_member_id'])\
                .execute()
        
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired"
        )
    
    # Check if already accepted
    if invitation['status'] == 'accepted':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already accepted"
        )
    
    if invitation['status'] == 'cancelled':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation was cancelled"
        )
    
    # Get inviter name
    inviter_name = 'Unknown'
    if invitation.get('users'):
        inviter_name = invitation['users'].get('naam', 'Unknown')
    
    return {
        'valid': True,
        'email': invitation['email'],
        'role': invitation['role'],
        'team_member_name': invitation.get('team_members', {}).get('naam') if invitation.get('team_members') else None,
        'bureau_name': invitation.get('tenderbureaus', {}).get('naam') if invitation.get('tenderbureaus') else None,
        'invited_by': inviter_name,
        'personal_message': invitation.get('personal_message'),
        'expires_at': invitation['expires_at']
    }


@router.post("/accept/{token}")
async def accept_invitation(
    token: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Accept an invitation. User must be logged in.
    Links the auth user to the team member and creates bureau access.
    """
    user_id = current_user['id']
    user_email = current_user.get('email', '')
    
    # Get invitation
    result = db.table('bureau_invites')\
        .select('*')\
        .eq('invite_token', token)\
        .eq('status', 'pending')\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation"
        )
    
    invitation = result.data[0]
    
    # Verify email matches (warning only)
    if invitation['email'].lower() != user_email.lower():
        print(f"⚠️ Email mismatch: invitation={invitation['email']}, user={user_email}")
    
    # Update invitation status
    db.table('bureau_invites')\
        .update({
            'status': 'accepted',
            'accepted_at': datetime.utcnow().isoformat()
        })\
        .eq('id', invitation['id'])\
        .execute()
    
    # Link user to team member (if team_member_id exists)
    if invitation.get('team_member_id'):
        db.table('team_members')\
            .update({
                'user_id': user_id,
                'invitation_status': 'accepted',
                'accepted_at': datetime.utcnow().isoformat()
            })\
            .eq('id', invitation['team_member_id'])\
            .execute()
    
    # Create or update user_bureau_access
    existing_access = db.table('user_bureau_access')\
        .select('id')\
        .eq('user_id', user_id)\
        .eq('tenderbureau_id', invitation['tenderbureau_id'])\
        .execute()
    
    if existing_access.data:
        # Update existing
        db.table('user_bureau_access')\
            .update({
                'role': invitation['role'],
                'is_active': True,
                'accepted_at': datetime.utcnow().isoformat()
            })\
            .eq('id', existing_access.data[0]['id'])\
            .execute()
    else:
        # Create new access
        db.table('user_bureau_access')\
            .insert({
                'user_id': user_id,
                'tenderbureau_id': invitation['tenderbureau_id'],
                'role': invitation['role'],
                'is_active': True,
                'invited_by': invitation['invited_by'],
                'accepted_at': datetime.utcnow().isoformat(),
                'capaciteit_uren_per_week': invitation.get('capaciteit_uren_per_week', 40)
            })\
            .execute()
    
    # Update user's default bureau if not set
    db.table('users')\
        .update({'last_bureau_id': invitation['tenderbureau_id']})\
        .eq('id', user_id)\
        .is_('last_bureau_id', 'null')\
        .execute()
    
    print(f"✅ Invitation accepted by user {user_id}")
    
    return {
        'success': True,
        'message': 'Invitation accepted successfully',
        'tenderbureau_id': invitation['tenderbureau_id'],
        'role': invitation['role']
    }


@router.post("/resend/{invitation_id}")
async def resend_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Resend an invitation (generates new token and extends expiry).
    """
    user_id = current_user['id']
    
    # Get invitation
    result = db.table('bureau_invites')\
        .select('*')\
        .eq('id', invitation_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    invitation = result.data[0]
    
    # Check permission
    can_invite = await check_user_can_invite(db, user_id, invitation['tenderbureau_id'])
    if not can_invite:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to resend invitations"
        )
    
    # Generate new token and extend expiry
    new_token = str(uuid.uuid4())
    new_expiry = datetime.utcnow() + timedelta(days=7)
    
    db.table('bureau_invites')\
        .update({
            'invite_token': new_token,
            'expires_at': new_expiry.isoformat(),
            'status': 'pending'
        })\
        .eq('id', invitation_id)\
        .execute()
    
    # Update team member status if linked
    if invitation.get('team_member_id'):
        db.table('team_members')\
            .update({
                'invitation_status': 'pending',
                'invited_at': datetime.utcnow().isoformat()
            })\
            .eq('id', invitation['team_member_id'])\
            .execute()
    
    print(f"📧 Invitation resent to {invitation['email']}")
    print(f"🔗 New URL: /accept-invitation.html?token={new_token}")
    
    # TODO: Send actual email
    
    return {
        'success': True,
        'message': 'Invitation resent successfully',
        'new_token': new_token
    }


@router.delete("/cancel/{invitation_id}")
async def cancel_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """
    Cancel a pending invitation.
    """
    user_id = current_user['id']
    
    # Get invitation
    result = db.table('bureau_invites')\
        .select('*')\
        .eq('id', invitation_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    invitation = result.data[0]
    
    # Check permission
    can_invite = await check_user_can_invite(db, user_id, invitation['tenderbureau_id'])
    if not can_invite:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel invitations"
        )
    
    # Update invitation status
    db.table('bureau_invites')\
        .update({
            'status': 'cancelled',
            'cancelled_at': datetime.utcnow().isoformat()
        })\
        .eq('id', invitation_id)\
        .execute()
    
    # Update team member status if linked
    if invitation.get('team_member_id'):
        db.table('team_members')\
            .update({'invitation_status': 'not_invited'})\
            .eq('id', invitation['team_member_id'])\
            .execute()
    
    print(f"❌ Invitation cancelled: {invitation['email']}")
    
    return {'success': True, 'message': 'Invitation cancelled'}
