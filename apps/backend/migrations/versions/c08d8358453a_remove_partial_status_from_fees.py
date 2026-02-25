"""remove_partial_status_from_fees

Revision ID: c08d8358453a
Revises: k0e1f2g3h4i5
Create Date: 2026-02-13 15:56:30.829347

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c08d8358453a"
down_revision: Union[str, None] = "k0e1f2g3h4i5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update all fees with 'partial' status to 'paid'
    # Since we removed paid_amount, any fee with partial payment is now considered paid
    op.execute("""
        UPDATE office_api.fees
        SET status = 'paid'
        WHERE status = 'partial'
    """)


def downgrade() -> None:
    # No downgrade needed - we can't restore the partial status accurately
    pass
