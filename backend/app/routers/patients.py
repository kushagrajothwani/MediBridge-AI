from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.access import (
    active_consents,
    age_from_dob,
    decide_access,
    iso,
    write_audit,
)
from app.database import get_db
from app.deps import require_roles

router = APIRouter(tags=["Patients and records"])


def find_patient(db: Session, mb_id: str):
    return (
        db.query(models.Patient)
        .filter(models.Patient.mb_patient_id == mb_id.strip().upper())
        .first()
    )


def patient_out(patient: models.Patient) -> schemas.PatientOut:
    return schemas.PatientOut(
        id=patient.mb_patient_id,
        name=patient.user.full_name,
        age=age_from_dob(patient.dob),
        sex=patient.gender,
        blood_group=patient.blood_group,
    )


def record_out(record: models.MedicalRecord, mb_id: str) -> schemas.RecordOut:
    return schemas.RecordOut(
        id=record.id,
        patient_id=mb_id,
        hospital_id=record.hospital_id,
        type=record.type,
        title=record.title,
        date=record.record_date.isoformat(),
        summary=record.summary,
        provenance=schemas.ProvenanceOut(
            extraction=record.extraction,
            verification=record.verification,
            uploaded_at=iso(record.uploaded_at),
            file_name=record.file_name,
        ),
        labs=record.labs,
        medications=record.medications,
        reports_no_medication=True if record.reports_no_medication else None,
    )


@router.get("/patients/me", response_model=schemas.PatientOut, response_model_exclude_none=True)
def my_profile(user: models.User = Depends(require_roles("patient"))):
    if user.patient is None:
        raise HTTPException(404, "Patient profile not found")
    return patient_out(user.patient)


@router.get("/patients/search", response_model=schemas.PatientOut, response_model_exclude_none=True)
def search_patient(
    q: str = Query(min_length=3, max_length=40),
    user: models.User = Depends(require_roles("doctor", "hospital_admin")),
    db: Session = Depends(get_db),
):
    """Returns only the patient 'shell'. No medical content."""
    patient = find_patient(db, q)
    if patient is None:
        raise HTTPException(404, "Patient not found")
    return patient_out(patient)


@router.get(
    "/patients/{mb_id}/records",
    response_model=schemas.RecordListOut,
    response_model_exclude_none=True,
)
def list_records(
    mb_id: str,
    user: models.User = Depends(require_roles("patient", "doctor", "hospital_admin")),
    db: Session = Depends(get_db),
):
    """Records the caller may see, newest first (this is the timeline),
    plus a count of records that exist but are locked (no content)."""
    patient = find_patient(db, mb_id)
    if user.role == "patient":
        if patient is None or patient.user_id != user.id:
            raise HTTPException(403, "Permission required")
    elif patient is None:
        raise HTTPException(404, "Patient not found")

    consents = active_consents(db, user, patient) if user.role == "doctor" else []
    records = (
        db.query(models.MedicalRecord)
        .filter(models.MedicalRecord.patient_id == patient.id)
        .order_by(models.MedicalRecord.record_date.desc(), models.MedicalRecord.id)
        .all()
    )

    visible, locked_counts = [], Counter()
    for record in records:
        allowed, label, needs_audit = decide_access(user, patient, record, consents)
        if allowed:
            visible.append(record_out(record, patient.mb_patient_id))
            if needs_audit:
                write_audit(db, user, patient, "view_records", record.id, label)
        else:
            locked_counts[record.hospital_id] += 1
    db.commit()

    locked = [
        schemas.LockedOut(hospital_id=h, count=n) for h, n in sorted(locked_counts.items())
    ]
    return schemas.RecordListOut(records=visible, locked=locked)


@router.get(
    "/records/{record_id}",
    response_model=schemas.RecordOut,
    response_model_exclude_none=True,
)
def get_record(
    record_id: str,
    user: models.User = Depends(require_roles("patient", "doctor", "hospital_admin")),
    db: Session = Depends(get_db),
):
    record = db.get(models.MedicalRecord, record_id)
    if record is None:
        raise HTTPException(404, "Record not found")
    patient = record.patient
    consents = active_consents(db, user, patient) if user.role == "doctor" else []

    allowed, label, needs_audit = decide_access(user, patient, record, consents)
    if not allowed:
        write_audit(db, user, patient, "access_denied", record.id, label)
        db.commit()
        raise HTTPException(403, "Permission required")
    if needs_audit:
        write_audit(db, user, patient, "view_records", record.id, label)
        db.commit()
    return record_out(record, patient.mb_patient_id)