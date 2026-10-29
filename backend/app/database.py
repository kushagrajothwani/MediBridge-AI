from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


def normalize_db_url(url: str) -> str:
    """Cloud providers give postgres:// or postgresql:// URLs. Our driver needs postgresql+psycopg://"""
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


engine = create_engine(
    normalize_db_url(settings.database_url),
    pool_pre_ping=True,   # drops dead connections after the database wakes from sleep
    pool_recycle=300,
    connect_args={"prepare_threshold": None},  # safe with pooled cloud connections
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()