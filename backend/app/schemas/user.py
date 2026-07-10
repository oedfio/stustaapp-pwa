from pydantic import BaseModel
from uuid import UUID


class UserUpdate(BaseModel):
    # Both fields optional — user can update one or both
    first_name: str | None = None
    last_name: str | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str | None
    last_name: str | None
    is_dev_admin: bool

    model_config = {"from_attributes": True}