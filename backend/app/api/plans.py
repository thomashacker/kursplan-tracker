"""
Training plan endpoints:
  POST /wochen/{id}/kopieren  — copy all sessions from one week to a new week
  GET  /wochen/{id}/export.pdf — generate printable PDF
  GET  /vereine/{slug}/kalender.ics — iCal export
"""
from datetime import date, datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from icalendar import Calendar, Event

from app.auth import CurrentUser
from app.models.schemas import CopyWeekRequest
from app.services.supabase import get_supabase

router = APIRouter()

DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]


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

    # Fetch source sessions
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
                "topic": s["topic"],
                "description": s["description"],
                "trainer_id": s["trainer_id"],
                "tags": s["tags"],
                "notes": s["notes"],
            }
            for s in sessions.data
        ]
        sb.table("training_sessions").insert(new_sessions).execute()

    return {"week_id": target_week_id, "sessions_copied": len(sessions.data or [])}


@router.get("/{week_id}/export.ics")
def export_ical(week_id: str):
    """Export all sessions of a week as an iCal (.ics) file."""
    sb = get_supabase()

    week = sb.table("training_weeks").select("*, clubs(name, is_public)").eq("id", week_id).single().execute()
    if not week.data:
        raise HTTPException(status_code=404, detail="Woche nicht gefunden")

    w = week.data
    if not w["clubs"]["is_public"] and not w["is_published"]:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    sessions = (
        sb.table("training_sessions")
        .select("*, locations(name), profiles!trainer_id(full_name)")
        .eq("week_id", week_id)
        .execute()
    )

    cal = Calendar()
    cal.add("prodid", "-//Kursplan-Tracker//DE")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", f"{w['clubs']['name']} – Trainingsplan")

    week_start = date.fromisoformat(w["week_start"])

    for s in sessions.data or []:
        ev = Event()
        session_date = week_start.replace(day=week_start.day + s["day_of_week"])
        start_dt = datetime.combine(session_date, datetime.strptime(s["time_start"], "%H:%M:%S").time())
        end_dt = datetime.combine(session_date, datetime.strptime(s["time_end"], "%H:%M:%S").time())

        ev.add("summary", s["topic"])
        ev.add("dtstart", start_dt.replace(tzinfo=timezone.utc))
        ev.add("dtend", end_dt.replace(tzinfo=timezone.utc))

        if s.get("locations"):
            ev.add("location", s["locations"]["name"])

        description_parts = []
        if s.get("description"):
            description_parts.append(s["description"])
        if s.get("profiles"):
            description_parts.append(f"Trainer: {s['profiles']['full_name']}")
        if s.get("tags"):
            description_parts.append(f"Tags: {', '.join(s['tags'])}")

        if description_parts:
            ev.add("description", "\n".join(description_parts))

        cal.add_component(ev)

    ical_bytes = cal.to_ical()
    return Response(
        content=ical_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=trainingsplan.ics"},
    )
