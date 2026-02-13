"""sync_paid_amount_with_status

Revision ID: 9bba72065910
Revises: c08d8358453a
Create Date: 2026-02-13 16:17:41.253067

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9bba72065910'
down_revision: Union[str, None] = 'c08d8358453a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update paid_amount to match amount for all fees with status='paid'
    # This ensures the paid_amount column reflects the actual status
    op.execute("""
        UPDATE office_api.fees
        SET paid_amount = amount
        WHERE status = 'paid' AND paid_amount != amount
    """)


def downgrade() -> None:
    # No downgrade needed - we can't restore the old paid_amount values accurately
    pass
