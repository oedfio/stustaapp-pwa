import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pywebpush import webpush, WebPushException
import json
import asyncio

from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user, require_dev_admin
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.models.org_follow import OrgFollow
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


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


async def send_push_to_all(title: str, body: str, url: str = "/", org_id=None):
    logger.info(f"send_push_to_all called: title={title}, org_id={org_id}")

    # Step 1 — fetch subscriptions and close the DB session
    async with AsyncSessionLocal() as db:
        if org_id is not None:
            result = await db.execute(
                select(PushSubscription)
                .join(OrgFollow, PushSubscription.user_id == OrgFollow.user_id)
                .where(OrgFollow.org_id == org_id)
            )
        else:
            result = await db.execute(select(PushSubscription))

        subscriptions = result.scalars().all()
        # Extract plain data so we don't hold onto ORM objects bound to this session
        sub_data = [
            {"id": s.id, "endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth}
            for s in subscriptions
        ]

    logger.info(f"Found {len(sub_data)} subscriptions to notify")

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

@router.post("/debug-send")
async def debug_send(user: User = Depends(require_dev_admin)):
    await send_push_to_all(
        title="Debug test",
        body="Direct call test",
        url="/",
        org_id="942b11b9-3558-4a1f-a09f-e15424c21b95",
    )
    return {"message": "done"}