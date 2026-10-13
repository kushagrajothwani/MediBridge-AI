from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app import models
from app.models import utcnow

RECORD_TYPES = {"encounter", "diagnosis", "prescription", "lab_report", "allergy", "discharge"}


def iso(value) -> Optional[str]:
    return value.isoformat(timespec="seconds") + "Z" if value else None


def age_from_dob(dob: Optional[date]) -> Optional[int]:
    if dob is None:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def consent_view(consent: models.Consent) -> str:
    """Effective status. A stored 'active' consent past its expiry counts as 'expired'."""
    if consent.status == "active" and consent.expires_at and consent.expires_at <= utcnow():
        return "expired"
    return consent.status


def active_consents(db: Session, doctor: models.User, patient: models.Patient):
    return (
        db.query(models.Consent)
        .filter(
            models.Consent.patient_id == patient.id,
            models.Consent.doctor_id == doctor.id,
            models.Consent.status == "active",
            models.Consent.expires_at > utcnow(),
        )
        .all()
    )


def decide_access(user: models.User, patient: models.Patient, record: models.MedicalRecord, consents):
    """Returns (allowed, consent_label, needs_audit).

    Rules:
      - A patient can read only their own records.
      - Staff can read their own hospital's records.
      - A doctor can read another hospital's records only with an active,
        unexpired consent that names that doctor and includes the record type.
      - Hospital admins never get cross-hospital access.
      - Default is deny.
    """
    if user.role == "patient":
        return patient.user_id == user.id, "Own record", False
    if user.role in ("doctor", "hospital_admin") and record.hospital_id == user.hospital_id:
        return True, "Not required (own hospital)", False
    if user.role == "doctor":
        for consent in consents:
            if record.type in (consent.scope or []):
                return True, f"Active ({consent.id})", True
        return False, "No active consent", False
    return False, "Not permitted", False


def write_audit(db, actor, patient, action, resource, consent_label, reason=None):
    """Adds an audit row. The caller commits.
    Identical view/denied events within 30 seconds are skipped to avoid log flooding."""
    import secrets
    from datetime import timedelta

    if action in ("view_records", "access_denied"):
        cutoff = utcnow() - timedelta(seconds=30)
        repeat = (
            db.query(models.AuditEvent)
            .filter(
                models.AuditEvent.actor_id == actor.id,
                models.AuditEvent.patient_id == patient.id,
                models.AuditEvent.action == action,
                models.AuditEvent.resource == resource,
                models.AuditEvent.at >= cutoff,
            )
            .first()
        )
        if repeat:
            return

    db.add(
        models.AuditEvent(
            id="A-" + secrets.token_hex(4).upper(),
            actor_id=actor.id,
            actor_name=actor.full_name,
            actor_hospital_id=actor.hospital_id,
            patient_id=patient.id,
            action=action,
            resource=resource,
            reason=reason,
            consent=consent_label,
        )
    )