import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# We expect DATABASE_URL to be set in the .env file.
# Default to an empty string to avoid immediate crashes before configuration
DATABASE_URL = os.getenv("DATABASE_URL", "")

# The Supabase PostgreSQL database URL needs to be compatible with SQLAlchemy.
# Ensure that the connection string starts with `postgresql://` instead of `postgres://` if present.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Initialize the SQLAlchemy Engine
# Note: For production use with Supabase, you might want to use the session pooler URL
engine = create_engine(DATABASE_URL) if DATABASE_URL else None

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
