from datetime import date, datetime

from app import models
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.security import hash_password

HOSPITALS = [
    ("H-A", "Sunrise General Hospital", "Hospital A", "a"),
    ("H-B", "CityCare Hospital", "Hospital B", "b"),
]

# id, email, name, role, title, hospital, demo password
USERS = [
    ("U-PAT-1", "rahul@example.com", "Rahul Sharma", "patient", "Patient", None, "Rahul12345"),
    ("U-PAT-2", "anita@example.com", "Anita Desai", "patient", "Patient", None, "Anita12345"),
    ("D-B-01", "meera@example.com", "Dr. Meera Iyer", "doctor", "Internal Medicine", "H-B", "Meera12345"),
    ("D-A-01", "arjun@example.com", "Dr. Arjun Rao", "doctor", "Endocrinology", "H-A", "Arjun12345"),
    ("AD-A-01", "admin.a@example.com", "Anil Verma", "hospital_admin", "Records administrator", "H-A", "Admin12345"),
    ("AD-B-01", "admin.b@example.com", "Sonal Gupta", "hospital_admin", "Records administrator", "H-B", "Admin12345"),
]

# user id -> (display patient id, date of birth, gender, blood group)
PATIENTS = {
    "U-PAT-1": ("MB-PAT-1001", date(1980, 6, 15), "Male", "B+"),
    "U-PAT-2": ("MB-PAT-1002", date(1992, 3, 20), "Female", "O+"),
}

REF = {"HbA1c": (4.0, 5.6), "Fasting glucose": (70, 99)}


def lab(name, value, unit, low, high):
    return {"name": name, "value": value, "unit": unit, "refLow": low, "refHigh": high}


RECORDS = [
    dict(id="Report-A-001", mb="MB-PAT-1001", hospital="H-A", type="lab_report",
         title="Blood report: HbA1c, fasting glucose, LDL", on=date(2026, 3, 12),
         summary="HbA1c 7.8%. Fasting glucose 142 mg/dL. LDL cholesterol within the reference range.",
         labs=[lab("HbA1c", 7.8, "%", 4.0, 5.6), lab("Fasting glucose", 142, "mg/dL", 70, 99),
               lab("LDL cholesterol", 98, "mg/dL", 0, 100)],
         extraction="OCR + manual review", verification="reviewed",
         uploaded="2026-03-12T11:20:00", file="blood_report_mar2026.pdf"),
    dict(id="Prescription-A-002", mb="MB-PAT-1001", hospital="H-A", type="prescription",
         title="Prescription: Metformin", on=date(2026, 3, 12),
         summary="Metformin 500 mg twice daily after meals. Review after three months.",
         meds=[{"name": "Metformin", "dose": "500 mg", "frequency": "twice daily after meals"}],
         extraction="OCR + manual review", verification="reviewed",
         uploaded="2026-03-12T11:42:00", file="prescription_a_002.pdf"),
    dict(id="Dx-A-003", mb="MB-PAT-1001", hospital="H-A", type="diagnosis",
         title="Type 2 diabetes mellitus", on=date(2026, 3, 12),
         summary="Diagnosed after raised fasting glucose and HbA1c. Diet and exercise counselling given.",
         extraction="Manual entry", verification="reviewed",
         uploaded="2026-03-12T12:05:00", file="entered in Hospital A system"),
    dict(id="Allergy-A-004", mb="MB-PAT-1001", hospital="H-A", type="allergy",
         title="Penicillin allergy", on=date(2026, 4, 18),
         summary="Skin rash after an amoxicillin course, reported by the patient. Severity recorded as mild.",
         extraction="Manual entry", verification="reviewed",
         uploaded="2026-04-18T09:30:00", file="entered in Hospital A system"),
    dict(id="Report-B-004", mb="MB-PAT-1001", hospital="H-B", type="lab_report",
         title="Follow-up blood report", on=date(2026, 6, 20),
         summary="HbA1c 7.2%. Fasting glucose 128 mg/dL.",
         labs=[lab("HbA1c", 7.2, "%", 4.0, 5.6), lab("Fasting glucose", 128, "mg/dL", 70, 99)],
         extraction="Structured upload", verification="reviewed",
         uploaded="2026-06-20T15:10:00", file="lab_feed_b_004.json"),
    dict(id="Visit-B-005", mb="MB-PAT-1001", hospital="H-B", type="encounter",
         title="Outpatient visit: tiredness and increased thirst", on=date(2026, 10, 4),
         summary="Tired for two weeks, drinking more water than usual. Patient reports no regular medications. BP 128/82.",
         no_med=True, extraction="Manual entry", verification="pending",
         uploaded="2026-10-04T10:14:00", file="entered in Hospital B system"),
    dict(id="Visit-B-101", mb="MB-PAT-1002", hospital="H-B", type="encounter",
         title="Outpatient visit: seasonal allergic rhinitis", on=date(2026, 9, 10),
         summary="Sneezing and itchy eyes for a week. Advised antihistamine as needed.",
         extraction="Manual entry", verification="reviewed",
         uploaded="2026-09-10T17:00:00", file="entered in Hospital B system"),
    dict(id="Report-B-102", mb="MB-PAT-1002", hospital="H-B", type="lab_report",
         title="Complete blood count", on=date(2026, 9, 10),
         summary="Haemoglobin and white cell count within reference ranges.",
         labs=[lab("Haemoglobin", 12.8, "g/dL", 12, 15.5)],
         extraction="OCR + manual review", verification="reviewed",
         uploaded="2026-09-10T17:20:00", file="cbc_sep2026.pdf"),
]

# NOTE: this consent ended on 1 Jul 2026, so it shows as "expired" today.
# That is intentional: the live demo creates a fresh request and grants it.
CONSENT = dict(id="C-0001", mb="MB-PAT-1001", doctor="D-B-01", hospital="H-B",
               scope=["lab_report"], reason="Reviewing diabetes follow-up results.",
               status="active", requested="2026-06-24T09:02:00",
               decided="2026-06-24T09:40:00", expires="2026-07-01T09:40:00")

# id, at, actor, patient mb, action, resource, reason, consent label
AUDIT = [
    ("A-001", "2026-03-12T11:42:00", "AD-A-01", "record_upload", "Prescription-A-002", None, "Not required (own hospital)"),
    ("A-002", "2026-04-18T09:30:00", "AD-A-01", "record_upload", "Allergy-A-004", None, "Not required (own hospital)"),
    ("A-003", "2026-06-20T15:10:00", "AD-B-01", "record_upload", "Report-B-004", None, "Not required (own hospital)"),
    ("A-004", "2026-06-24T09:02:00", "D-B-01", "consent_requested", "C-0001", "Reviewing diabetes follow-up results.", "Pending"),
    ("A-005", "2026-06-24T09:40:00", "U-PAT-1", "consent_granted", "C-0001", "Lab reports for 7 days", "Granted"),
    ("A-006", "2026-06-24T09:50:00", "D-B-01", "view_records", "Report-A-001", None, "Active (C-0001)"),
]


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def seed() -> None:
    if settings.app_env == "production":
        raise RuntimeError("Refusing to seed demo data in production")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for hid, name, short, tone in HOSPITALS:
            if db.get(models.Hospital, hid) is None:
                db.add(models.Hospital(id=hid, name=name, short=short, tone=tone))
        db.flush()

        for uid, email, name, role, title, hospital, password in USERS:
            if db.get(models.User, uid) is None:
                db.add(models.User(id=uid, email=email, full_name=name,
                                   password_hash=hash_password(password),
                                   role=role, title=title, hospital_id=hospital))
        db.flush()

        for uid, (mb, dob, gender, blood) in PATIENTS.items():
            if db.query(models.Patient).filter_by(mb_patient_id=mb).first() is None:
                db.add(models.Patient(user_id=uid, mb_patient_id=mb, dob=dob,
                                      gender=gender, blood_group=blood))
        db.flush()

        by_mb = {p.mb_patient_id: p for p in db.query(models.Patient).all()}

        for r in RECORDS:
            if db.get(models.MedicalRecord, r["id"]) is None:
                db.add(models.MedicalRecord(
                    id=r["id"], patient_id=by_mb[r["mb"]].id, hospital_id=r["hospital"],
                    type=r["type"], title=r["title"], record_date=r["on"], summary=r["summary"],
                    labs=r.get("labs"), medications=r.get("meds"),
                    reports_no_medication=r.get("no_med", False),
                    extraction=r["extraction"], verification=r["verification"],
                    uploaded_at=dt(r["uploaded"]), file_name=r["file"]))

        if db.get(models.Consent, CONSENT["id"]) is None:
            c = CONSENT
            db.add(models.Consent(
                id=c["id"], patient_id=by_mb[c["mb"]].id, doctor_id=c["doctor"],
                hospital_id=c["hospital"], scope=c["scope"], reason=c["reason"],
                status=c["status"], requested_at=dt(c["requested"]),
                decided_at=dt(c["decided"]), expires_at=dt(c["expires"])))
        db.flush()

        users = {u.id: u for u in db.query(models.User).all()}
        for aid, at, actor, action, resource, reason, label in AUDIT:
            if db.get(models.AuditEvent, aid) is None:
                u = users[actor]
                db.add(models.AuditEvent(
                    id=aid, at=dt(at), actor_id=u.id, actor_name=u.full_name,
                    actor_hospital_id=u.hospital_id, patient_id=by_mb["MB-PAT-1001"].id,
                    action=action, resource=resource, reason=reason, consent=label))
        db.commit()
    finally:
        db.close()
    print("Seed complete: 2 hospitals, 6 demo users, 2 patients, 8 records")


if __name__ == "__main__":
    seed()