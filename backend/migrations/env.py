import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.config import settings
from app.database import Base

# This import is critical — it forces Python to load all four model files
# so Alembic can see them and include them in the migration.
# Without this line, Alembic would generate an empty migration.
import app.models

# context is the Alembic object that controls the migration process
config = context.config

# Set up logging using the configuration defined in alembic.ini
# This makes Alembic print helpful messages during migration
fileConfig(config.config_file_name)

# Tell Alembic which tables to track — Base.metadata contains
# the definitions of all models that inherit from Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    # Offline mode generates SQL scripts to a file instead of
    # running them directly. Useful if you want to review the SQL
    # before applying it, or if you do not have direct DB access.
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    # Online mode connects directly to PostgreSQL and runs the
    # migrations immediately. This is what we use normally.

    # Create a temporary async engine just for running migrations
    connectable = create_async_engine(settings.database_url)

    # Open a connection to the database
    async with connectable.connect() as connection:

        # run_sync is needed because Alembic's internals are synchronous
        # even though we are using an async engine. This bridges the gap.
        await connection.run_sync(
            lambda conn: context.configure(
                connection=conn,
                target_metadata=target_metadata,
            )
        )

        # Begin a transaction and run the actual migration SQL
        async with connection.begin():
            await connection.run_sync(lambda conn: context.run_migrations())


def run_async_migrations() -> None:
    # Entry point that runs the async migration function
    # using Python's asyncio event loop
    asyncio.run(run_migrations_online())


# Alembic calls this file directly. Depending on whether offline
# or online mode was requested, it calls the right function.
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_async_migrations()