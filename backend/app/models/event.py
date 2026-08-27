import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class RecurrenceType(enum.Enum):
    none = "none"
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    day_before_notification_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hour_before_notification_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence: Mapped[RecurrenceType] = mapped_column(
        Enum(RecurrenceType),
        default=RecurrenceType.none,
        nullable=False
    )