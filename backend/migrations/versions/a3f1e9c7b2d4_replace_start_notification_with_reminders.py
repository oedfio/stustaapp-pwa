"""replace start notification flag with day-before/hour-before reminder flags

Revision ID: a3f1e9c7b2d4
Revises: cd557af655aa
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1e9c7b2d4'
down_revision: Union[str, Sequence[str], None] = 'cd557af655aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('day_before_notification_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('events', sa.Column('hour_before_notification_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.drop_column('events', 'start_notification_sent')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('events', sa.Column('start_notification_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.drop_column('events', 'hour_before_notification_sent')
    op.drop_column('events', 'day_before_notification_sent')
