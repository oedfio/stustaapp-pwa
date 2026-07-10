from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
):
    # Returns the current user's basic info
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Update first and/or last name
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"User updated: {user.email}. New values: {update_data}")
    return user


@router.get("/me/memberships")
async def get_my_memberships(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Returns all organisations the current user belongs to and their role in each
    result = await db.execute(
        select(OrgMembership, Organization)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(OrgMembership.user_id == user.id)
    )
    rows = result.all()

    return [
        {
            "org_id": str(membership.org_id),
            "org_name": org.name,
            "org_logo_url": org.logo_url,
            "role": membership.role.value,
        }
        for membership, org in rows
    ]