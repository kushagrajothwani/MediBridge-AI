from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.database import Base, engine, get_db
from app.routers import audit, auth, consents, demo, patients, records

Base.metadata.create_all(bind=engine)

if settings.seed_on_startup:
    from app.seed import seed

    seed()  # idempotent; refuses to run when APP_ENV=production

app = FastAPI(title="MediBridge AI API", version="0.5.0")

origins = [o.strip().rstrip("/") for o in settings.frontend_url.split(",") if o.strip()]
if settings.app_env == "development":
    origins += [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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