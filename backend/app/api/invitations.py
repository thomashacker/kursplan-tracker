"""
Invitation flow:
  POST /einladungen         — admin creates invitation, sends email
  GET  /einladungen/{token} — anyone looks up an invitation by token
  POST /einladungen/{token}/annehmen — authenticated user accepts invite
"""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.config import settings
from app.models.schemas import InvitationCreate, InvitationResponse
from app.services.email import send_invitation_email
from app.services.supabase import get_supabase

router = APIRouter()


@router.post("", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(body: InvitationCreate, user: CurrentUser):
    sb = get_supabase()
    user_id = user["sub"]

    # Verify the caller is an admin of the club
    membership = (
        sb.table("club_memberships")
        .select("role")
        .eq("club_id", str(body.club_id))
        .eq("user_id", user_id)
        .eq("status", "active")
        .single()
        .execute()
    )
    if not membership.data or membership.data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nur Admins können einladen")

    # Fetch club name and inviter name for the email
    club = sb.table("clubs").select("name").eq("id", str(body.club_id)).single().execute()
    inviter = sb.table("profiles").select("full_name").eq("id", user_id).single().execute()
    club_name = club.data["name"] if club.data else "deinen Verein"
    inviter_name = inviter.data["full_name"] if inviter.data else "Jemand"

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    result = (
        sb.table("invitations")
        .insert({
            "club_id": str(body.club_id),
            "email": body.email,
            "role": body.role,
            "token": token,
            "created_by": user_id,
            "expires_at": expires_at.isoformat(),
        })
        .execute()
    )

    invitation = result.data[0]
    accept_url = f"{settings.frontend_url}/einladung/{token}"

    try:
        send_invitation_email(
            to_email=body.email,
            club_name=club_name,
            invited_by_name=inviter_name,
            role=body.role,
            accept_url=accept_url,
        )
    except Exception:
        # Don't fail the request if email sending fails — log and continue
        pass

    return invitation


@router.get("/{token}")
def get_invitation(token: str):
    sb = get_supabase()
    result = (
        sb.table("invitations")
        .select("*, clubs(name, slug)")
        .eq("token", token)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Einladung nicht gefunden")

    inv = result.data
    if inv.get("used_at"):
        raise HTTPException(status_code=410, detail="Einladung wurde bereits verwendet")
    if datetime.fromisoformat(inv["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Einladung ist abgelaufen")

    return inv


@router.post("/{token}/annehmen", status_code=status.HTTP_200_OK)
def accept_invitation(token: str, user: CurrentUser):
    sb = get_supabase()
    user_id = user["sub"]

    result = (
        sb.table("invitations")
        .select("*")
        .eq("token", token)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Einladung nicht gefunden")

    inv = result.data
    if inv.get("used_at"):
        raise HTTPException(status_code=410, detail="Einladung wurde bereits verwendet")
    if datetime.fromisoformat(inv["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Einladung ist abgelaufen")

    # Upsert membership (handles case where user is already a member)
    sb.table("club_memberships").upsert({
        "club_id": inv["club_id"],
        "user_id": user_id,
        "role": inv["role"],
        "status": "active",
        "invited_by": inv["created_by"],
    }, on_conflict="club_id,user_id").execute()

    # Mark invitation as used
    sb.table("invitations").update({
        "used_at": datetime.now(timezone.utc).isoformat(),
        "used_by": user_id,
    }).eq("id", inv["id"]).execute()

    return {"club_id": inv["club_id"], "role": inv["role"]}
