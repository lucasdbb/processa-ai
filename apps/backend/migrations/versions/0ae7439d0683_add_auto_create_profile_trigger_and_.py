"""add auto create profile trigger and google oauth

Revision ID: 0ae7439d0683
Revises: 001_initial
Create Date: 2026-01-28 09:25:52.958500

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0ae7439d0683"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create function to automatically create profile when user signs up
    op.execute("""
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.profiles (id, email, name, role, status, avatar_url)
          VALUES (
            NEW.id,
            NEW.email,
            COALESCE(
              NEW.raw_user_meta_data->>'full_name',
              NEW.raw_user_meta_data->>'name',
              SPLIT_PART(NEW.email, '@', 1)
            ),
            'client',
            'active',
            NEW.raw_user_meta_data->>'avatar_url'
          )
          ON CONFLICT (id) DO UPDATE SET
            name = COALESCE(
              EXCLUDED.name,
              public.profiles.name
            ),
            avatar_url = COALESCE(
              EXCLUDED.avatar_url,
              public.profiles.avatar_url
            );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Create trigger that executes function after user is created in auth.users
    op.execute("""
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_new_user();
    """)


def downgrade() -> None:
    # Remove trigger
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")

    # Remove function
    op.execute("DROP FUNCTION IF EXISTS public.handle_new_user()")
