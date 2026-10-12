from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.database import Base, engine, get_db
from app.routers import audit, auth, consents, demo, patients, records

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MediBridge AI API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(records.router)
app.include_router(consents.router)
app.include_router(audit.router)

# The reset endpoint wipes the database, so it exists ONLY in development.
if settings.app_env == "development":
    app.include_router(demo.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "MediBridge AI"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}