import os

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool


def _get_database_url() -> str:
    load_dotenv()

    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        raise RuntimeError("DATABASE_URL is required")

    if raw.startswith("postgresql://") and "+" not in raw.split(":", 1)[0]:
        return raw.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw


config = context.config
config.set_main_option("sqlalchemy.url", _get_database_url())


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="ai_worker",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        connection.exec_driver_sql("create schema if not exists ai_worker")
        connection.commit()  # Commit da criação do schema

        context.configure(connection=connection, version_table_schema="ai_worker")

        with connection.begin():  # Transação explícita
            with context.begin_transaction():
                context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
