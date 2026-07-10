from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# The engine is the actual connection to PostgreSQL
engine = create_async_engine(settings.database_url)

# A session factory — each request gets its own session
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# Base class that all models will inherit from
class Base(DeclarativeBase):
    pass


# Dependency that FastAPI will inject into route functions
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session