import os
import logging
from sqlalchemy import select, text
from app.database import AsyncSessionLocal
from datetime import datetime, timezone
from sqlalchemy import select
from app.models.event import Event
from app.models.organization import Organization
from app.routers.notifications import send_push_to_all

logger = logging.getLogger(__name__)

MEDIA_DIRS = {
    "logos": "/srv/stustaapp/media/logos",
    "events": "/srv/stustaapp/media/events",
}


async def cleanup_unused_media():
    """
    Runs weekly. Deletes any image files in the media folders
    that are no longer referenced in the database.
    """
    logger.info("Starting weekly media cleanup task")

    async with AsyncSessionLocal() as db:
        # Fetch all logo and photo URLs currently stored in the database
        result = await db.execute(
            text("SELECT logo_url FROM organizations WHERE logo_url IS NOT NULL")
        )
        org_logos = {row[0] for row in result.fetchall()}

        result = await db.execute(
            text("SELECT photo_url FROM events WHERE photo_url IS NOT NULL")
        )
        event_photos = {row[0] for row in result.fetchall()}

    # Combine all URLs that are currently in use
    urls_in_use = org_logos | event_photos

    deleted_count = 0

    # Check logos folder
    for filename in os.listdir(MEDIA_DIRS["logos"]):
        filepath = f"/media/logos/{filename}"
        if filepath not in urls_in_use:
            full_path = os.path.join(MEDIA_DIRS["logos"], filename)
            os.remove(full_path)
            deleted_count += 1
            logger.info(f"Deleted unused logo: {filename}")

    # Check events folder
    for filename in os.listdir(MEDIA_DIRS["events"]):
        filepath = f"/media/events/{filename}"
        if filepath not in urls_in_use:
            full_path = os.path.join(MEDIA_DIRS["events"], filename)
            os.remove(full_path)
            deleted_count += 1
            logger.info(f"Deleted unused event photo: {filename}")

    logger.info(f"Media cleanup complete — {deleted_count} files deleted")

async def send_event_start_notifications():
    """
    Runs every few minutes. Finds events that have started
    (starts_at <= now) and haven't had their start notification sent yet.
    """
    logger.info("Checking for events starting now")

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(Event, Organization)
            .join(Organization, Event.org_id == Organization.id)
            .where(
                Event.starts_at <= now,
                Event.start_notification_sent == False,
            )
        )
        rows = result.all()

        for event, org in rows:
            await send_push_to_all(
                title=f"{event.title} is starting now!",
                body=f"{org.name} — {event.location or ''}".strip(" —"),
                url=f"/events/{event.id}",
                org_id=org.id,
            )
            event.start_notification_sent = True
            logger.info(f"Sent start notification for event {event.title}")

        await db.commit()