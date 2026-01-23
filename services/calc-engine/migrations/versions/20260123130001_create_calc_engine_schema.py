from alembic import op

revision = "20260123130001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("create extension if not exists pgcrypto")
    op.execute("create schema if not exists calc_engine")

    op.execute(
        """
        create table calc_engine.calculations (
          id uuid primary key default gen_random_uuid(),
          calculator_key text not null,
          status text not null,
          user_id text not null,
          client_id text,
          input_payload jsonb,
          output_payload jsonb,
          error text,
          created_at timestamptz not null default now(),
          finished_at timestamptz,
          constraint ck_calc_engine_calculations_status check (
            status in ('processing','completed','failed')
          )
        )
        """
    )
    op.execute(
        (
            "create index ix_calc_engine_calculations_user_id_created_at "
            "on calc_engine.calculations (user_id, created_at)"
        )
    )
    op.execute(
        (
            "create index ix_calc_engine_calculations_calculator_key_created_at "
            "on calc_engine.calculations (calculator_key, created_at)"
        )
    )

    op.execute(
        """
        create table calc_engine.documents (
          id uuid primary key default gen_random_uuid(),
          calculation_id uuid,
          user_id text not null,
          client_id text,
          document_type text not null,
          bucket text not null,
          storage_path text not null,
          filename text not null,
          checksum_sha256 text,
          size_bytes bigint,
          mime_type text not null default 'application/pdf',
          metadata jsonb,
          created_at timestamptz not null default now(),
          constraint fk_calc_engine_documents_calculation_id foreign key (calculation_id)
            references calc_engine.calculations (id) on delete set null,
          constraint uq_calc_engine_documents_bucket_path unique (bucket, storage_path)
        )
        """
    )
    op.execute(
        (
            "create index ix_calc_engine_documents_user_id_created_at "
            "on calc_engine.documents (user_id, created_at)"
        )
    )

    op.execute("alter table calc_engine.calculations enable row level security")
    op.execute("alter table calc_engine.documents enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists calc_engine.documents")
    op.execute("drop table if exists calc_engine.calculations")
    op.execute("drop schema if exists calc_engine")
