import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pywebpush import webpush, WebPushException
import json
import asyncio

from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user, require_dev_admin
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.models.org_follow import OrgFollow
from app.models.notification import Notification
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class BroadcastRequest(BaseModel):
    title: str
    body: str
    url: str = "/"


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    body: str
    url: str | None
    created_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    # Public key needed by the frontend to subscribe
    return {"public_key": settings.vapid_public_key}


@router.post("/subscribe", status_code=201)
async def subscribe(
    payload: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Check if this exact endpoint already exists
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update ownership in case the same device re-subscribes under a new user
        existing.user_id = user.id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
        )
        db.add(sub)

    await db.commit()
    return {"message": "Subscribed successfully"}


@router.delete("/unsubscribe", status_code=200)
async def unsubscribe(
    payload: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == user.id,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()
    return {"message": "Unsubscribed successfully"}


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return {"count": result.scalar_one()}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)

    return notification


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    for notification in result.scalars().all():
        notification.read_at = now
    await db.commit()
    return {"message": "All notifications marked as read"}


async def send_push_to_all(title: str, body: str, url: str = "/", org_id=None):
    logger.info(f"send_push_to_all called: title={title}, org_id={org_id}")

    # Step 1 — resolve target users (org followers, or everyone), persist an
    # in-app notification row for each of them, and fetch their push
    # subscriptions. Users without a push subscription still get the in-app
    # notification, just no OS-level push.
    async with AsyncSessionLocal() as db:
        if org_id is not None:
            result = await db.execute(
                select(OrgFollow.user_id).where(OrgFollow.org_id == org_id)
            )
        else:
            result = await db.execute(select(User.id))
        target_user_ids = [row[0] for row in result.all()]

        for user_id in target_user_ids:
            db.add(Notification(user_id=user_id, title=title, body=body, url=url))
        await db.commit()

        sub_data = []
        if target_user_ids:
            result = await db.execute(
                select(PushSubscription).where(PushSubscription.user_id.in_(target_user_ids))
            )
            # Extract plain data so we don't hold onto ORM objects bound to this session
            sub_data = [
                {"id": s.id, "endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth}
                for s in result.scalars().all()
            ]

    logger.info(f"Notified {len(target_user_ids)} users, {len(sub_data)} with push subscriptions")

    # Step 2 — send pushes without holding a DB session open
    invalid_ids = []
    for sub in sub_data:
        logger.info(f"About to send push to subscription {sub['id']}")
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth": sub["auth"],
                    },
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_claim_email},
                timeout=10,
            )
            logger.info(f"Push sent successfully to subscription {sub['id']}")
        except WebPushException as e:
            logger.warning(f"Push failed for subscription {sub['id']}: {e}")
            if e.response is not None and e.response.status_code in (404, 410):
                invalid_ids.append(sub["id"])
        except Exception as e:
            logger.error(f"Unexpected error sending push to {sub['id']}: {e}")

    # Step 3 — clean up invalid subscriptions in a fresh session
    if invalid_ids:
        async with AsyncSessionLocal() as db:
            for sub_id in invalid_ids:
                obj = await db.get(PushSubscription, sub_id)
                if obj:
                    await db.delete(obj)
            await db.commit()

@router.post("/broadcast", status_code=202)
async def broadcast_notification(
    payload: BroadcastRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_dev_admin),
):
    # Dev admin only — sends an in-app notification (and a push, for
    # anyone with a subscription) to every user in the system
    background_tasks.add_task(
        send_push_to_all,
        title=payload.title,
        body=payload.body,
        url=payload.url,
        org_id=None,
    )
    logger.info(f"Broadcast queued by {user.email}: {payload.title}")
    return {"message": "Broadcast queued"}


@router.post("/debug-send")
async def debug_send(user: User = Depends(require_dev_admin)):
    await send_push_to_all(
        title="Debug test",
        body="Direct call test",
        url="/",
        org_id="942b11b9-3558-4a1f-a09f-e15424c21b95",
    )
    return {"message": "done"}