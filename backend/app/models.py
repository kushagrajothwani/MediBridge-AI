import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Naive UTC datetime. All stored times are UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True)  # "H-A", "H-B"
    name = Column(String, nullable=False)
    short = Column(String, nullable=False)  # "Hospital A"
    tone = Column(String, nullable=False)  # "a" or "b" (used by the UI)

    users = relationship("User", back_populates="hospital")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # patient, doctor, hospital_admin
    title = Column(String, nullable=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    hospital = relationship("Hospital", back_populates="users")
    patient = relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    mb_patient_id = Column(String, unique=True, nullable=False, index=True)
    dob = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)

    user = relationship("User", back_populates="patient")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(String, primary_key=True)  # e.g. "Report-A-001"
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    record_date = Column(Date, nullable=False)
    summary = Column(Text, nullable=False)
    labs = Column(JSON, nullable=True)
    medications = Column(JSON, nullable=True)
    reports_no_medication = Column(Boolean, nullable=False, default=False)
    extraction = Column(String, nullable=False)
    verification = Column(String, nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=utcnow)
    file_name = Column(String, nullable=False)

    patient = relationship("Patient")
    hospital = relationship("Hospital")


class Consent(Base):
    __tablename__ = "consents"

    id = Column(String, primary_key=True)  # e.g. "C-0001"
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=False)
    scope = Column(JSON, nullable=False)  # list of record types
    reason = Column(Text, nullable=False)
    kind = Column(String, nullable=False, default="standard")
    status = Column(String, nullable=False, default="pending")
    requested_at = Column(DateTime, nullable=False, default=utcnow)
    decided_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])


class AuditEvent(Base):
    """Append-only. There is intentionally no update or delete route for this table."""

    __tablename__ = "audit_events"

    id = Column(String, primary_key=True)
    at = Column(DateTime, nullable=False, default=utcnow, index=True)
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)
    actor_name = Column(String, nullable=False)
    actor_hospital_id = Column(String, nullable=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    consent = Column(String, nullable=False)

    patient = relationship("Patient")