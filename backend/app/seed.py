from app import models
from app.database import Base, SessionLocal, engine


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    hospitals = [
        ("City General Hospital (Hospital A)", "HOSP-A"),
        ("Riverside Medical Center (Hospital B)", "HOSP-B"),
    ]
    for name, code in hospitals:
        if not db.query(models.Hospital).filter_by(code=code).first():
            db.add(models.Hospital(name=name, code=code))
    db.commit()
    db.close()
    print("Seed complete: HOSP-A and HOSP-B ready")


if __name__ == "__main__":
    seed()