from fastapi import APIRouter

from app.database import Base, engine
from app.seed import seed

router = APIRouter(prefix="/demo", tags=["Demo (development only)"])


@router.post("/reset")
def reset_demo():
    """Wipes ALL data and reloads the synthetic demo data. Mounted only when APP_ENV=development."""
    Base.metadata.drop_all(bind=engine)
    seed()
    return {"status": "demo data reset"}