from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import models, schemas
from app.access import iso, write_audit
from app.database import get_db
from app.deps import require_roles

router = APIRouter(tags=["Audit"])


@router.get("/audit", response_model=list[schemas.AuditOut], response_model_exclude_none=True)
def audit_log(
    user: models.User = Depends(require_roles("patient", "doctor", "hospital_admin")),
    db: Session = Depends(get_db),
):
    """Patients see everything done to their records. Doctors see their own actions.
    Hospital admins see their own hospital's staff actions."""
    query = db.query(models.AuditEvent)
    if user.role == "patient":
        if user.patient is None:
            return []
        query = query.filter(models.AuditEvent.patient_id == user.patient.id)
    elif user.role == "doctor":
        query = query.filter(models.AuditEvent.actor_id == user.id)
    else:
        query = query.filter(models.AuditEvent.actor_hospital_id == user.hospital_id)

    events = query.order_by(models.AuditEvent.at.desc()).limit(200).all()
    return [
        schemas.AuditOut(
            id=e.id, at=iso(e.at), actor_id=e.actor_id, actor_name=e.actor_name,
            actor_hospital_id=e.actor_hospital_id, patient_id=e.patient.mb_patient_id,
            action=e.action, resource=e.resource, reason=e.reason, consent=e.consent,
        )
        for e in events
    ]


@router.post("/audit/ai", status_code=204)
def log_ai_summary(
    data: schemas.AiAuditIn,
    user: models.User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
):
    """Records that a doctor generated an AI summary for a patient."""
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.mb_patient_id == data.patient_id.strip().upper())
        .first()
    )
    if patient is None:
        raise HTTPException(404, "Patient not found")
    write_audit(db, user, patient, "ai_summary", "AI assistant", "Checked per record", data.query.strip())
    db.commit()
    return Response(status_code=204)