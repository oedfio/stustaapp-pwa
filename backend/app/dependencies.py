from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.auth import decode_jwt
from app.database import get_db
from app.models.user import User
from app.models.membership import OrgMembership, MembershipRole

# OAuth2PasswordBearer is kept for OpenAPI specification compatibility
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/verify-otp", auto_error=False)

# HTTPBearer shows a simple token input field in Swagger UI
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token_fallback: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Try HTTPBearer first, fall back to OAuth2PasswordBearer
    token = credentials.credentials if credentials else token_fallback

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decode the JWT and extract the user ID
    try:
        user_id = decode_jwt(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fetch the user from PostgreSQL
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


async def require_dev_admin(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_dev_admin:
        raise HTTPException(status_code=403, detail="Dev admin access required")
    return user


async def require_boss_admin(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if user.is_dev_admin:
        return user

    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user.id,
            OrgMembership.org_id == org_id,
            OrgMembership.role == MembershipRole.boss_admin,
        )
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(status_code=403, detail="Boss admin access required")
    return user


async def require_org_admin(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if user.is_dev_admin:
        return user

    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user.id,
            OrgMembership.org_id == org_id,
            OrgMembership.role.in_([MembershipRole.org_admin, MembershipRole.boss_admin]),
        )
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(status_code=403, detail="Org admin access required")
    return user