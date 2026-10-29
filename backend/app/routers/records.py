from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.access import RECORD_TYPES, write_audit
from app.database import get_db
from app.deps import require_roles
from app.routers.patients import find_patient, record_out

router = APIRouter(tags=["Records"])

PREFIX = {
    "lab_report": "Report", "prescription": "Prescription", "diagnosis": "Dx",
    "allergy": "Allergy", "encounter": "Visit", "discharge": "Discharge",
}


def next_record_id(db: Session, rtype: str, hospital_id: str) -> str:
    base = f"{PREFIX[rtype]}-{hospital_id[-1]}-"
    n = db.query(models.MedicalRecord).filter(models.MedicalRecord.id.like(base + "%")).count() + 1
    while db.get(models.MedicalRecord, f"{base}{n:03d}") is not None:
        n += 1
    return f"{base}{n:03d}"


@router.post("/records", response_model=schemas.RecordOut, response_model_exclude_none=True, status_code=201)
def create_record(
    data: schemas.RecordCreateIn,
    user: models.User = Depends(require_roles("hospital_admin")),
    db: Session = Depends(get_db),
):
    """A hospital admin adds a record. It is always stored under the admin's own hospital."""
    patient = find_patient(db, data.patient_id)
    if patient is None:
        raise HTTPException(404, "Patient not found")
    if data.type not in RECORD_TYPES:
        raise HTTPException(422, "Unknown record type")

    record = models.MedicalRecord(
        id=next_record_id(db, data.type, user.hospital_id),
        patient_id=patient.id,
        hospital_id=user.hospital_id,
        type=data.type,
        title=data.title.strip(),
        record_date=data.date,
        summary=data.summary.strip(),
        labs=[x.model_dump(by_alias=True) for x in data.labs] if data.labs else None,
        medications=[x.model_dump() for x in data.medications] if data.medications else None,
        reports_no_medication=data.reports_no_medication,
        extraction=data.extraction,
        verification=data.verification,
        file_name=data.file_name,
    )
    db.add(record)
    db.flush()
    write_audit(db, user, patient, "record_upload", record.id, "Not required (own hospital)")
    db.commit()
    db.refresh(record)
    return record_out(record, patient.mb_patient_id)