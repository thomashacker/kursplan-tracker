from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ──────────────────────────────────────────────────────────
# Invitations
# ──────────────────────────────────────────────────────────

class InvitationCreate(BaseModel):
    club_id: UUID
    email: EmailStr
    role: str = "member"


class InvitationResponse(BaseModel):
    id: UUID
    club_id: UUID
    email: str
    role: str
    token: str
    expires_at: datetime
    used_at: Optional[datetime] = None


class InvitationAccept(BaseModel):
    token: str


# ──────────────────────────────────────────────────────────
# Training Weeks / Sessions
# ──────────────────────────────────────────────────────────

class CopyWeekRequest(BaseModel):
    source_week_id: UUID
    target_week_start: date  # must be a Monday


class SessionOut(BaseModel):
    id: UUID
    week_id: UUID
    day_of_week: int
    time_start: time
    time_end: time
    location_id: Optional[UUID] = None
    topic: str
    description: Optional[str] = None
    trainer_id: Optional[UUID] = None
    tags: list[str] = []
    notes: Optional[str] = None


class WeekOut(BaseModel):
    id: UUID
    club_id: UUID
    week_start: date
    is_published: bool
    notes: Optional[str] = None
    sessions: list[SessionOut] = []
