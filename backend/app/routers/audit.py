from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.access import iso
from app.database import get_db
from app.deps import require_roles

router = APIRouter(tags=["Audit"])


@router.get("/audit", response_model=list[schemas.AuditOut], response_model_exclude_none=True)
def audit_log(
    user: models.User = Depends(require_roles("patient", "hospital_admin")),
    db: Session = Depends(get_db),
):
    """Patients see everything done to their records. Hospital admins see their own staff's actions."""
    query = db.query(models.AuditEvent)
    if user.role == "patient":
        if user.patient is None:
            return []
        query = query.filter(models.AuditEvent.patient_id == user.patient.id)
    else:
        query = query.filter(models.AuditEvent.actor_hospital_id == user.hospital_id)

    events = query.order_by(models.AuditEvent.at.desc()).limit(200).all()
    return [
        schemas.AuditOut(
            id=e.id,
            at=iso(e.at),
            actor_id=e.actor_id,
            actor_name=e.actor_name,
            actor_hospital_id=e.actor_hospital_id,
            patient_id=e.patient.mb_patient_id,
            action=e.action,
            resource=e.resource,
            reason=e.reason,
            consent=e.consent,
        )
        for e in events
    ]