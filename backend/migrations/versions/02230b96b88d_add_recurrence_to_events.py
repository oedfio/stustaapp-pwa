"""add recurrence to events

Revision ID: 02230b96b88d
Revises: 06b38e1959f3
Create Date: 2026-05-15 21:22:31.922920

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02230b96b88d'
down_revision: Union[str, Sequence[str], None] = '06b38e1959f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type in PostgreSQL first
    op.execute("CREATE TYPE recurrencetype AS ENUM ('none', 'weekly', 'biweekly', 'monthly')")
    # Then add the column using that type
    op.add_column('events', sa.Column('recurrence', sa.Enum('none', 'weekly', 'biweekly', 'monthly', name='recurrencetype'), nullable=False, server_default='none'))


def downgrade() -> None:
    op.drop_column('events', 'recurrence')
    # Drop the enum type after dropping the column
    op.execute("DROP TYPE recurrencetype")