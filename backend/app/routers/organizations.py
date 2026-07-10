from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import os
import time

from app.database import get_db
from app.dependencies import get_current_user, require_dev_admin, require_boss_admin
from app.uploads import read_validated_image
from app.models.organization import Organization
from app.models.membership import OrgMembership
from app.models.user import User
from app.models.event import Event
from app.schemas.organization import OrganizationCreate, OrganizationUpdate, OrganizationResponse
from app.models.org_follow import OrgFollow

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

LOGO_DIR = "/srv/stustaapp/media/logos"


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
):
    # Public endpoint — no auth required
    result = await db.execute(select(Organization))
    return result.scalars().all()


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    # Public endpoint — no auth required
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_dev_admin),
):
    # Dev admin only — create a new organisation
    org = Organization(**payload.model_dump())
    db.add(org)
    await db.commit()
    await db.refresh(org)

    logger.info(f"Organization created: {org.name} by {user.email}")
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_boss_admin),
):
    # Boss admin only — update organisation info
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")

    # Only update fields that were actually sent in the request
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)

    logger.info(f"Organization updated: {org.name} by {user.email}")
    return org

@router.delete("/{org_id}", status_code=200)
async def delete_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_dev_admin),
):
    # Dev admin only — delete an organisation and all its memberships and events
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")

    # Delete all memberships for this org
    await db.execute(
        OrgMembership.__table__.delete().where(OrgMembership.org_id == org_id)
    )

    # Delete all follows for this org
    await db.execute(
        OrgFollow.__table__.delete().where(OrgFollow.org_id == org_id)
    )

    # Delete all events for this org
    await db.execute(
        Event.__table__.delete().where(Event.org_id == org_id)
    )

    # Delete the org itself
    await db.delete(org)
    await db.commit()

    logger.info(f"Organisation {org.name} deleted by dev admin {user.email}")
    return {"message": "Organisation deleted successfully"}


@router.post("/{org_id}/logo", response_model=OrganizationResponse)
async def upload_logo(
    org_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_boss_admin),
):
    # Boss admin only — upload organisation logo
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")

    # Validate type/size and derive a safe extension from the content type
    data, extension = await read_validated_image(file)

    # Save the file to disk using org ID + timestamp as filename
    filename = f"{org_id}_{int(time.time())}.{extension}"
    filepath = os.path.join(LOGO_DIR, filename)

    with open(filepath, "wb") as buffer:
        buffer.write(data)

    # Store the path in the database
    org.logo_url = f"/media/logos/{filename}"
    await db.commit()
    await db.refresh(org)

    logger.info(f"Organization logo uploaded: {org.name} by {user.email}")
    return org


@router.get("/{org_id}/memberships")
async def get_org_memberships(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Boss admins and dev admins can see the list of admins
    if not user.is_dev_admin:
        result = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.org_id == org_id,
                OrgMembership.role == MembershipRole.boss_admin,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Boss admin access required")

    # Join memberships with users to get full user details
    result = await db.execute(
        select(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .where(OrgMembership.org_id == org_id)
    )
    rows = result.all()

    return [
        {
            "user_id": str(membership.user_id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": membership.role.value,
        }
        for membership, user in rows
    ]


@router.post("/{org_id}/admins", status_code=201)
async def invite_admin(
    org_id: UUID,
    email: str,
    role: str = "org_admin",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.membership import MembershipRole

    # Validate the role
    if role not in ("org_admin", "boss_admin"):
        raise HTTPException(status_code=400, detail="Role must be org_admin or boss_admin")

    # Only dev admins can assign boss_admin role
    if role == "boss_admin" and not user.is_dev_admin:
        raise HTTPException(status_code=403, detail="Only dev admins can assign boss admin role")

    # Boss admins can only invite org_admins to their OWN org
    if not user.is_dev_admin:
        result = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.org_id == org_id,
                OrgMembership.role == MembershipRole.boss_admin,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise HTTPException(status_code=403, detail="Boss admin access required for this organisation")

    # Find the user by email
    result = await db.execute(select(User).where(User.email == email))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found — they must log in to the app first")

    # Check if they already have a membership for this specific org
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == target_user.id,
            OrgMembership.org_id == org_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="User is already an admin of this organisation")

    # Create the membership with the specified role for THIS org only
    membership = OrgMembership(
        user_id=target_user.id,
        org_id=org_id,
        role=MembershipRole(role),
    )
    db.add(membership)
    await db.commit()

    logger.info(f"Admin invited: {target_user.email} as {role} in organization {org_id} by {user.email}")
    return {"message": f"{role} invited successfully"}

@router.delete("/{org_id}/admins/{user_id}", status_code=200)
async def remove_admin(
    org_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_boss_admin),
):
    # Boss admin only — remove an admin from this organisation
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = result.scalar_one_or_none()

    target_user = await db.execute(select(User).where(User.id == user_id))
    target_user = target_user.scalar()

    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")

    await db.delete(membership)
    await db.commit()

    logger.info(f"Admin removed: {target_user.email} from organization {org_id} by {user.email}")
    return {"message": "Admin removed successfully"}

@router.post("/{org_id}/follow", status_code=201)
async def follow_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OrgFollow).where(OrgFollow.user_id == user.id, OrgFollow.org_id == org_id)
    )
    if result.scalar_one_or_none():
        return {"message": "Already following"}

    db.add(OrgFollow(user_id=user.id, org_id=org_id))
    await db.commit()
    return {"message": "Followed successfully"}


@router.delete("/{org_id}/follow", status_code=200)
async def unfollow_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OrgFollow).where(OrgFollow.user_id == user.id, OrgFollow.org_id == org_id)
    )
    follow = result.scalar_one_or_none()
    if follow:
        await db.delete(follow)
        await db.commit()
    return {"message": "Unfollowed successfully"}


@router.get("/me/follows")
async def get_my_follows(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OrgFollow.org_id).where(OrgFollow.user_id == user.id)
    )
    return [str(row[0]) for row in result.all()]