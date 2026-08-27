import os
import logging
from sqlalchemy import select, text, func, or_
from app.config import settings
from app.database import AsyncSessionLocal
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from app.models.event import Event
from app.models.organization import Organization
from app.routers.notifications import send_push_to_all

logger = logging.getLogger(__name__)

LOCAL_TZ = ZoneInfo("Europe/Berlin")

MEDIA_DIRS = {
    "logos": os.path.join(settings.media_root, "logos"),
    "events": os.path.join(settings.media_root, "events"),
}

# How long a past event's photo stays around after the event is over.
# Org logos have no equivalent — an org doesn't "end" the way an event does.
EVENT_PHOTO_RETENTION = timedelta(days=30)


async def purge_old_event_photos():
    """
    Deletes the photo file for any event that ended (or, if it has no
    ends_at, started) more than EVENT_PHOTO_RETENTION ago, and clears
    photo_url so the DB never points at a file that's no longer there.

    A photo can be reused across events (see the events/{id}/photo/reuse
    endpoint), so a stale event's file is only actually deleted once no
    still-active event references the same photo_url — otherwise this
    would delete a file out from under an event that's still using it.
    """
    cutoff = datetime.now(timezone.utc) - EVENT_PHOTO_RETENTION
    purged_count = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Event.photo_url).where(
                Event.photo_url.is_not(None),
                func.coalesce(Event.ends_at, Event.starts_at) >= cutoff,
            )
        )
        active_photo_urls = {row[0] for row in result.all()}

        result = await db.execute(
            select(Event).where(
                Event.photo_url.is_not(None),
                func.coalesce(Event.ends_at, Event.starts_at) < cutoff,
            )
        )
        stale_events = result.scalars().all()

        for event in stale_events:
            if event.photo_url in active_photo_urls:
                continue  # still in use by a non-expired event — leave it alone

            full_path = os.path.join(settings.media_root, event.photo_url.removeprefix("/media/"))
            if os.path.exists(full_path):
                os.remove(full_path)
            event.photo_url = None
            purged_count += 1
            logger.info(f"Purged photo for event past retention: {event.title}")

        await db.commit()

    logger.info(f"Old event photo purge complete — {purged_count} photos removed")


async def cleanup_unused_media():
    """
    Runs weekly. First purges photos for events past their retention
    window, then deletes any remaining image files in the media folders
    that are no longer referenced in the database at all.
    """
    logger.info("Starting weekly media cleanup task")

    await purge_old_event_photos()

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

async def send_event_reminder_notifications():
    """
    Runs every few minutes. Sends two one-time reminder pushes per event:
    one the day before at 18:00 Europe/Berlin, and one an hour before the
    event starts. Events past their start time are no longer candidates.
    """
    logger.info("Checking for event reminders to send")

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(Event, Organization)
            .join(Organization, Event.org_id == Organization.id)
            .where(
                Event.starts_at > now,
                or_(
                    Event.day_before_notification_sent == False,
                    Event.hour_before_notification_sent == False,
                ),
            )
        )
        rows = result.all()

        for event, org in rows:
            local_start = event.starts_at.astimezone(LOCAL_TZ)
            day_before_trigger = datetime(
                local_start.year, local_start.month, local_start.day,
                18, 0, tzinfo=LOCAL_TZ,
            ) - timedelta(days=1)

            if not event.day_before_notification_sent and now >= day_before_trigger:
                await send_push_to_all(
                    title=f"Tomorrow: {event.title}",
                    body=f"{org.name} — {event.location or ''}".strip(" —"),
                    url=f"/events/{event.id}",
                    org_id=org.id,
                )
                event.day_before_notification_sent = True
                logger.info(f"Sent day-before reminder for event {event.title}")

            hour_before_trigger = event.starts_at - timedelta(hours=1)
            if not event.hour_before_notification_sent and now >= hour_before_trigger:
                await send_push_to_all(
                    title=f"{event.title} starts in an hour",
                    body=f"{org.name} — {event.location or ''}".strip(" —"),
                    url=f"/events/{event.id}",
                    org_id=org.id,
                )
                event.hour_before_notification_sent = True
                logger.info(f"Sent hour-before reminder for event {event.title}")

        await db.commit()