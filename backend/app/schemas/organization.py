from pydantic import BaseModel
from uuid import UUID


class OrganizationCreate(BaseModel):
    name: str
    short_description: str | None = None
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    short_description: str | None = None
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    short_description: str | None
    description: str | None
    location_name: str | None
    latitude: float | None
    longitude: float | None
    logo_url: str | None

    model_config = {"from_attributes": True}