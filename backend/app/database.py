from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    """Gives each request its own database session, then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()