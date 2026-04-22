"""
Training plan endpoints:
  POST /wochen/{id}/kopieren  — copy all sessions from one week to a new week
"""
from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.models.schemas import CopyWeekRequest
from app.services.supabase import get_supabase

router = APIRouter()


@router.post("/{week_id}/kopieren", status_code=status.HTTP_201_CREATED)
def copy_week(week_id: str, body: CopyWeekRequest, user: CurrentUser):
    """
    Copy all sessions from an existing week to a new week.
    Creates the target week if it doesn't exist yet.
    """
    sb = get_supabase()
    user_id = user["sub"]

    # Fetch source week
    source = sb.table("training_weeks").select("*").eq("id", week_id).single().execute()
    if not source.data:
        raise HTTPException(status_code=404, detail="Quellwoche nicht gefunden")

    club_id = source.data["club_id"]

    # Verify caller can edit
    membership = (
        sb.table("club_memberships")
        .select("role")
        .eq("club_id", club_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .single()
        .execute()
    )
    if not membership.data or membership.data["role"] not in ("admin", "trainer"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")

    if body.target_week_start.weekday() != 0:
        raise HTTPException(status_code=422, detail="Zieldatum muss ein Montag sein")

    # Create or fetch target week
    existing = (
        sb.table("training_weeks")
        .select("id")
        .eq("club_id", club_id)
        .eq("week_start", body.target_week_start.isoformat())
        .execute()
    )
    if existing.data:
        target_week_id = existing.data[0]["id"]
    else:
        new_week = (
            sb.table("training_weeks")
            .insert({
                "club_id": club_id,
                "week_start": body.target_week_start.isoformat(),
                "is_published": False,
                "created_by": user_id,
            })
            .execute()
        )
        target_week_id = new_week.data[0]["id"]

    # Fetch source sessions (including new array columns)
    sessions = (
        sb.table("training_sessions")
        .select("*")
        .eq("week_id", week_id)
        .execute()
    )

    if sessions.data:
        new_sessions = [
            {
                "week_id": target_week_id,
                "day_of_week": s["day_of_week"],
                "time_start": s["time_start"],
                "time_end": s["time_end"],
                "location_id": s["location_id"],
                "topic": s.get("topic"),
                "topics": s.get("topics", []),
                "session_types": s.get("session_types", []),
                "description": s.get("description"),
                "trainer_id": s.get("trainer_id"),
                "tags": s.get("tags", []),
            }
            for s in sessions.data
        ]
        sb.table("training_sessions").insert(new_sessions).execute()

    return {"week_id": target_week_id, "sessions_copied": len(sessions.data or [])}
