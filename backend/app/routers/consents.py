import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.access import RECORD_TYPES, consent_view, iso, write_audit
from app.database import get_db
from app.deps import require_roles
from app.models import utcnow

router = APIRouter(prefix="/consents", tags=["Consent"])


def consent_out(c: models.Consent) -> schemas.ConsentOut:
    return schemas.ConsentOut(
        id=c.id,
        patient_id=c.patient.mb_patient_id,
        doctor_id=c.doctor_id,
        doctor_name=c.doctor.full_name,
        hospital_id=c.hospital_id,
        scope=c.scope or [],
        reason=c.reason,
        kind=c.kind,
        status=c.status,
        view=consent_view(c),
        requested_at=iso(c.requested_at),
        decided_at=iso(c.decided_at),
        expires_at=iso(c.expires_at),
    )


def load_for_patient(db: Session, consent_id: str, user: models.User) -> models.Consent:
    consent = db.get(models.Consent, consent_id)
    if consent is None:
        raise HTTPException(404, "Consent not found")
    if consent.patient.user_id != user.id:
        raise HTTPException(403, "Only the patient can decide on this consent")
    return consent


@router.post("/request", response_model=schemas.ConsentOut, response_model_exclude_none=True, status_code=201)
def request_consent(
    data: schemas.ConsentRequestIn,
    user: models.User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
):
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.mb_patient_id == data.patient_id.strip().upper())
        .first()
    )
    if patient is None:
        raise HTTPException(404, "Patient not found")
    unknown = set(data.scope) - RECORD_TYPES
    if unknown:
        raise HTTPException(422, f"Unknown record type(s): {', '.join(sorted(unknown))}")
    pending = (
        db.query(models.Consent)
        .filter_by(patient_id=patient.id, doctor_id=user.id, status="pending")
        .first()
    )
    if pending:
        raise HTTPException(409, "A request from you is already waiting for this patient")

    reason = data.reason.strip()
    consent = models.Consent(
        id="C-" + secrets.token_hex(4).upper(),
        patient_id=patient.id,
        doctor_id=user.id,
        hospital_id=user.hospital_id,
        scope=sorted(set(data.scope)),
        reason=reason,
        kind="standard",
        status="pending",
    )
    db.add(consent)
    db.flush()
    write_audit(db, user, patient, "consent_requested", consent.id, "Pending", reason)
    db.commit()
    db.refresh(consent)
    return consent_out(consent)


@router.get("/mine", response_model=list[schemas.ConsentOut], response_model_exclude_none=True)
def my_consents(
    user: models.User = Depends(require_roles("patient", "doctor")),
    db: Session = Depends(get_db),
):
    query = db.query(models.Consent)
    if user.role == "patient":
        if user.patient is None:
            return []
        query = query.filter(models.Consent.patient_id == user.patient.id)
    else:
        query = query.filter(models.Consent.doctor_id == user.id)
    return [consent_out(c) for c in query.order_by(models.Consent.requested_at.desc()).all()]


@router.post("/{consent_id}/grant", response_model=schemas.ConsentOut, response_model_exclude_none=True)
def grant(
    consent_id: str,
    data: Optional[schemas.ConsentGrantIn] = None,
    user: models.User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    consent = load_for_patient(db, consent_id, user)
    if consent.status != "pending":
        raise HTTPException(409, "Only pending requests can be granted")
    days = data.duration_days if data else 7
    if data and data.scope is not None:
        chosen = sorted(set(data.scope))
        if not chosen or not set(chosen) <= set(consent.scope or []):
            raise HTTPException(422, "Scope must be a non-empty part of what was requested")
        consent.scope = chosen
    now = utcnow()
    consent.status = "active"
    consent.decided_at = now
    consent.expires_at = now + timedelta(days=days)
    write_audit(
        db, user, consent.patient, "consent_granted", consent.id, "Granted",
        f"{', '.join(consent.scope)} for {days} days",
    )
    db.commit()
    db.refresh(consent)
    return consent_out(consent)


@router.post("/{consent_id}/reject", response_model=schemas.ConsentOut, response_model_exclude_none=True)
def reject(
    consent_id: str,
    user: models.User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    consent = load_for_patient(db, consent_id, user)
    if consent.status != "pending":
        raise HTTPException(409, "Only pending requests can be rejected")
    consent.status = "rejected"
    consent.decided_at = utcnow()
    write_audit(db, user, consent.patient, "consent_rejected", consent.id, "Rejected")
    db.commit()
    db.refresh(consent)
    return consent_out(consent)


@router.post("/{consent_id}/revoke", response_model=schemas.ConsentOut, response_model_exclude_none=True)
def revoke(
    consent_id: str,
    user: models.User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    consent = load_for_patient(db, consent_id, user)
    if consent.status != "active":
        raise HTTPException(409, "Only active consents can be revoked")
    consent.status = "revoked"
    consent.decided_at = utcnow()
    write_audit(db, user, consent.patient, "consent_revoked", consent.id, "Revoked")
    db.commit()
    db.refresh(consent)
    return consent_out(consent)
from datetime import timedelta
EMERGENCY_SCOPE = ["allergy", "diagnosis", "prescription"]
EMERGENCY_HOURS = 2


@router.post("/emergency", response_model=schemas.ConsentOut, response_model_exclude_none=True, status_code=201)
def emergency_access(
    data: schemas.EmergencyIn,
    user: models.User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
):
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.mb_patient_id == data.patient_id.strip().upper())
        .first()
    )
    if patient is None:
        raise HTTPException(404, "Patient not found")

    now = utcnow()
    reason = data.reason.strip()
    consent = models.Consent(
        id="C-" + secrets.token_hex(4).upper(),
        patient_id=patient.id,
        doctor_id=user.id,
        hospital_id=user.hospital_id,
        scope=EMERGENCY_SCOPE,
        reason=reason,
        kind="emergency",
        status="active",
        requested_at=now,
        decided_at=now,
        expires_at=now + timedelta(hours=EMERGENCY_HOURS),
    )
    db.add(consent)
    db.flush()
    write_audit(db, user, patient, "emergency_access", consent.id, f"Emergency ({consent.id})", reason)
    db.commit()
    db.refresh(consent)
    return consent_out(consent)