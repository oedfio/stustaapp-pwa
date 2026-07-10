from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from enum import Enum


class RecurrenceType(str, Enum):
    none = "none"
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    location: str | None = None
    recurrence: RecurrenceType = RecurrenceType.none


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = None
    recurrence: RecurrenceType | None = None


class EventResponse(BaseModel):
    id: UUID
    org_id: UUID
    created_by: UUID
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime | None
    location: str | None
    photo_url: str | None
    recurrence: RecurrenceType

    model_config = {"from_attributes": True}


class EventWithOrgResponse(BaseModel):
    id: UUID
    org_id: UUID
    created_by: UUID
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime | None
    location: str | None
    photo_url: str | None
    recurrence: RecurrenceType
    org_name: str
    org_logo_url: str | None
    org_latitude: float | None
    org_longitude: float | None

    model_config = {"from_attributes": True}