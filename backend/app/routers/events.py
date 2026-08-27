from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone, timedelta
import os
import time

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_org_admin
from app.uploads import read_validated_image, save_image
from app.models.event import Event
from app.models.organization import Organization
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventResponse, EventWithOrgResponse, EventPhotoReuse, EventPhoto

import logging
from sqlalchemy import or_, and_, func

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["events"])

EVENTS_MEDIA_DIR = os.path.join(settings.media_root, "events")

# How long a finished event stays visible in the Manage tab before it's
# hidden from the list. Matches the event-photo retention window.
MANAGE_EVENT_RETENTION = timedelta(days=30)


@router.get("/events", response_model=list[EventWithOrgResponse])
async def list_events(
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)
    no_end_grace = now - timedelta(hours=24)

    result = await db.execute(
        select(Event, Organization)
        .join(Organization, Event.org_id == Organization.id)
        .where(
            Event.starts_at <= week_end,
            # Show the event while it hasn't ended yet. Events without an
            # explicit end time are treated as lasting 24h from their start
            # so they don't vanish the instant starts_at passes.
            or_(
                Event.ends_at >= now,
                and_(Event.ends_at == None, Event.starts_at >= no_end_grace),
            ),
        )
        .order_by(Event.starts_at.asc())
    )
    rows = result.all()

    return [
        EventWithOrgResponse(
            id=event.id,
            org_id=event.org_id,
            created_by=event.created_by,
            title=event.title,
            description=event.description,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            location=event.location,
            photo_url=event.photo_url,
            recurrence=event.recurrence,
            org_name=org.name,
            org_logo_url=org.logo_url,
            org_latitude=org.latitude,
            org_longitude=org.longitude,
        )
        for event, org in rows
    ]


@router.get("/events/{event_id}", response_model=EventWithOrgResponse)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    # Public endpoint — returns a single event with org info
    result = await db.execute(
        select(Event, Organization)
        .join(Organization, Event.org_id == Organization.id)
        .where(Event.id == event_id)
    )
    row = result.first()

    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")

    event, org = row
    return EventWithOrgResponse(
        id=event.id,
        org_id=event.org_id,
        created_by=event.created_by,
        title=event.title,
        description=event.description,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        location=event.location,
        photo_url=event.photo_url,
        recurrence=event.recurrence,
        org_name=org.name,
        org_logo_url=org.logo_url,
        org_latitude=org.latitude,
        org_longitude=org.longitude,
    )


@router.get("/organizations/{org_id}/events", response_model=list[EventResponse])
async def list_org_events(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)
    no_end_grace = now - timedelta(hours=24)

    result = await db.execute(
        select(Event)
        .where(
            Event.org_id == org_id,
            Event.starts_at <= week_end,
            or_(
                Event.ends_at >= now,
                and_(Event.ends_at == None, Event.starts_at >= no_end_grace),
            ),
        )
        .order_by(Event.starts_at.asc())
    )
    return result.scalars().all()


@router.get("/organizations/{org_id}/events/manage", response_model=list[EventResponse])
async def list_org_events_for_management(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    # Org admin only — unfiltered by the "next 7 days" window used by the
    # public listing, so admins can find and edit events scheduled further
    # out. Events that ended (or, with no ends_at, started) more than
    # MANAGE_EVENT_RETENTION ago drop off the list — same cutoff as photo
    # cleanup, so an event's photo and its Manage-tab visibility expire
    # together.
    cutoff = datetime.now(timezone.utc) - MANAGE_EVENT_RETENTION

    result = await db.execute(
        select(Event)
        .where(
            Event.org_id == org_id,
            func.coalesce(Event.ends_at, Event.starts_at) >= cutoff,
        )
        .order_by(Event.starts_at.desc())
    )
    return result.scalars().all()


@router.get("/organizations/{org_id}/events/photos", response_model=list[EventPhoto])
async def list_org_event_photos(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    # Org admin only — every photo the org has ever uploaded for an event
    # (regardless of the event's own age/visibility), most recent first, so
    # a new event can reuse one instead of uploading a duplicate file. Not
    # filtered by MANAGE_EVENT_RETENTION: a photo stays reusable even after
    # its original event has aged out of the Manage list.
    result = await db.execute(
        select(Event.id, Event.title, Event.photo_url)
        .where(Event.org_id == org_id, Event.photo_url.is_not(None))
        .order_by(Event.starts_at.desc())
    )

    seen_urls = set()
    photos = []
    for event_id, title, photo_url in result.all():
        if photo_url in seen_urls:
            continue
        seen_urls.add(photo_url)
        photos.append(EventPhoto(event_id=event_id, event_title=title, photo_url=photo_url))

    return photos[:30]


@router.post("/organizations/{org_id}/events", response_model=EventResponse, status_code=201)
async def create_event(
    org_id: UUID,
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    event = Event(
        org_id=org_id,
        created_by=user.id,
        **payload.model_dump()
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    logger.info(f"Event created: {event.title} by {user.email} in the organization {org.name}")
    return event


@router.patch("/organizations/{org_id}/events/{event_id}", response_model=EventResponse)
async def update_event(
    org_id: UUID,
    event_id: UUID,
    payload: EventUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.org_id == org_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)

    logger.info(f"Event updated: {event.title} by {user.email} in org {event.org_id}")
    return event


@router.delete("/organizations/{org_id}/events/{event_id}", status_code=200)
async def delete_event(
    org_id: UUID,
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.org_id == org_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(event)
    await db.commit()

    logger.info(f"Event deleted: {event.title} by {user.email} in the organization {org_id}")
    return {"message": "Event deleted successfully"}


@router.post("/organizations/{org_id}/events/{event_id}/photo", response_model=EventResponse)
async def upload_event_photo(
    org_id: UUID,
    event_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.org_id == org_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    data, extension = await read_validated_image(file)

    # Save file to disk using event ID + timestamp as filename
    filename = f"{event_id}_{int(time.time())}.{extension}"
    filepath = os.path.join(EVENTS_MEDIA_DIR, filename)

    await save_image(filepath, data)

    event.photo_url = f"/media/events/{filename}"
    await db.commit()
    await db.refresh(event)
    
    logger.info(f"Event photo uploaded: {event.title} by {user.email} in the organization {org_id}")
    return event


@router.post("/organizations/{org_id}/events/{event_id}/photo/reuse", response_model=EventResponse)
async def reuse_event_photo(
    org_id: UUID,
    event_id: UUID,
    payload: EventPhotoReuse,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_org_admin),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.org_id == org_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    # The photo must belong to this org — i.e. some other event of theirs
    # already uses this exact URL — so an admin can't point an event at an
    # arbitrary/other-org media path.
    result = await db.execute(
        select(Event.id).where(Event.org_id == org_id, Event.photo_url == payload.photo_url)
    )
    if result.first() is None:
        raise HTTPException(status_code=400, detail="Photo not found for this organisation")

    event.photo_url = payload.photo_url
    await db.commit()
    await db.refresh(event)

    logger.info(f"Event photo reused: {event.title} by {user.email} in the organization {org_id}")
    return event