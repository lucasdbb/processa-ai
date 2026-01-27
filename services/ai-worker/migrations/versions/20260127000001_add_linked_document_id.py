from alembic import op

revision = "20260127000001"
down_revision = "20260123120001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adicionar coluna linked_document_id para relacionar input/output
    op.execute(
        """
        alter table ai_worker.documents
        add column linked_document_id uuid,
        add constraint fk_ai_worker_documents_linked_document_id foreign key (linked_document_id)
            references ai_worker.documents (id) on delete set null
        """
    )

    # Adicionar índice para facilitar busca de documentos linkados
    op.execute(
        "create index ix_ai_worker_documents_linked_document_id on ai_worker.documents "
        "(linked_document_id) where linked_document_id is not null"
    )

    # Adicionar coluna input_hash em jobs para facilitar cache
    op.execute(
        """
        alter table ai_worker.jobs
        add column input_hash text
        """
    )

    # Adicionar índice para busca por hash (cache)
    op.execute(
        "create index ix_ai_worker_jobs_input_hash on ai_worker.jobs "
        "(endpoint_key, input_hash, status) where input_hash is not null"
    )


def downgrade() -> None:
    op.execute("drop index if exists ix_ai_worker_jobs_input_hash")
    op.execute("alter table ai_worker.jobs drop column if exists input_hash")
    op.execute("drop index if exists ix_ai_worker_documents_linked_document_id")
    op.execute("alter table ai_worker.documents drop column if exists linked_document_id")
