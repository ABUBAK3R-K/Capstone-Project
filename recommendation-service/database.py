import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()


def normalize_database_url(url: str) -> str:
    """Pin the psycopg2 driver explicitly.

    Supabase hands out `postgres://` / `postgresql://` URLs. SQLAlchemy 2.0
    maps a bare `postgresql://` to psycopg2, but 2.1 changed that default to
    psycopg (v3) — so a fresh `pip install -r requirements.txt` (which
    resolves to 2.1) crashed at startup with "No module named 'psycopg'".
    Naming the driver works on both.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg2://" + url[len(prefix):]
    return url


# We expect DATABASE_URL to be set in the .env file.
# Default to an empty string to avoid immediate crashes before configuration
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", ""))

# Initialize the SQLAlchemy Engine
# Note: For production use with Supabase, you might want to use the session pooler URL
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300) if DATABASE_URL else None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Dependency to yield a database session for FastAPI endpoints.
    """
    if not engine:
        raise RuntimeError("DATABASE_URL is not configured.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
