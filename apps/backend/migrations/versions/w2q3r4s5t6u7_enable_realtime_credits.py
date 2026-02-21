"""Enable realtime for user_credits table

Revision ID: w2q3r4s5t6u7
Revises: v1p2q3r4s5t6
Create Date: 2024-03-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'w2q3r4s5t6u7'
down_revision = 'v1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user_credits table to supabase_realtime publication
    # This is specific to Supabase
    op.execute("ALTER PUBLICATION supabase_realtime ADD TABLE user_credits;")


def downgrade() -> None:
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE user_credits;")
