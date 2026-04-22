"""
Club-level endpoints that require backend logic beyond direct Supabase access.
Most club CRUD is handled directly by the frontend via Supabase client + RLS.
"""
from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.services.supabase import get_supabase

router = APIRouter()


@router.get("/{slug}/mitglieder")
def list_members(slug: str, user: CurrentUser):
    """List all active members of a club with their profile info."""
    sb = get_supabase()
    user_id = user["sub"]

    club = sb.table("clubs").select("id").eq("slug", slug).single().execute()
    if not club.data:
        raise HTTPException(status_code=404, detail="Verein nicht gefunden")

    club_id = club.data["id"]

    # Verify caller is a member
    membership = (
        sb.table("club_memberships")
        .select("role")
        .eq("club_id", club_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .single()
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    members = (
        sb.table("club_memberships")
        .select("id, role, status, joined_at, profiles(id, full_name, username, avatar_url)")
        .eq("club_id", club_id)
        .neq("status", "suspended")
        .execute()
    )
    return members.data
