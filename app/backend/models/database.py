import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://hospitalpp:hospitalpp@localhost:5432/hospitalpp",
)

# Normalize the connection URL for SQLAlchemy's async engine. Replit provides
# DATABASE_URL in the standard "postgresql://" form, but SQLAlchemy needs the
# "+asyncpg" driver tag. Also strip "sslmode" query params that asyncpg doesn't
# accept (asyncpg uses "ssl" instead).
def _normalize_async_url(url: str) -> str:
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    if parts.query:
        kept = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                if k.lower() not in {"sslmode", "channel_binding"}]
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url


DATABASE_URL = _normalize_async_url(DATABASE_URL)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
