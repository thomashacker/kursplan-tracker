"""
Account management endpoints.
Requires a valid Supabase JWT — all mutations apply to the authenticated user only.
"""
from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.services.supabase import get_supabase

router = APIRouter()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(current_user: CurrentUser) -> None:
    """
    Permanently delete the authenticated user's account.
    Cascades to profiles, club_memberships, etc. via DB ON DELETE CASCADE.
    """
    user_id: str = current_user["sub"]
    sb = get_supabase()
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Konto konnte nicht gelöscht werden: {exc}",
        ) from exc
