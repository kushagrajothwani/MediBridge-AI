import datetime as dt
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


# ---------------- Authentication ----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=100)
    role: Literal["patient"] = "patient"  # staff accounts are NOT self-service
    dob: Optional[dt.date] = None
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    blood_group: Optional[Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    title: Optional[str] = None
    hospital_code: Optional[str] = None  # holds the hospital id, e.g. "H-B"
    mb_patient_id: Optional[str] = None


# ---------------- API shapes that match the frontend (camelCase) ----------------
class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PatientOut(CamelModel):
    id: str
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    blood_group: Optional[str] = None


class ProvenanceOut(CamelModel):
    extraction: str
    verification: str
    uploaded_at: str
    file_name: str


class RecordOut(CamelModel):
    id: str
    patient_id: str
    hospital_id: str
    type: str
    title: str
    date: str
    summary: str
    provenance: ProvenanceOut
    labs: Optional[list[dict[str, Any]]] = None
    medications: Optional[list[dict[str, Any]]] = None
    reports_no_medication: Optional[bool] = None


class LockedOut(CamelModel):
    hospital_id: str
    count: int


class RecordListOut(CamelModel):
    records: list[RecordOut]
    locked: list[LockedOut]


class ConsentRequestIn(CamelModel):
    patient_id: str
    scope: list[str] = Field(min_length=1)
    reason: str = Field(min_length=5, max_length=300)


class ConsentGrantIn(CamelModel):
    duration_days: int = Field(default=7, ge=1, le=30)
    scope: Optional[list[str]] = None  # may only narrow the original request

class ConsentOut(CamelModel):
    id: str
    patient_id: str
    doctor_id: str
    doctor_name: str
    hospital_id: str
    scope: list[str]
    reason: str
    kind: str
    status: str  # stored status
    view: str  # effective status (shows "expired" when time has run out)
    requested_at: str
    decided_at: Optional[str] = None
    expires_at: Optional[str] = None


class AuditOut(CamelModel):
    id: str
    at: str
    actor_id: str
    actor_name: str
    actor_hospital_id: Optional[str] = None
    patient_id: str
    action: str
    resource: str
    reason: Optional[str] = None
    consent: str

class LabIn(CamelModel):
    name: str = Field(min_length=1, max_length=60)
    value: float
    unit: str = Field(max_length=20)
    ref_low: float
    ref_high: float


class MedicationIn(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    dose: str = Field(max_length=40)
    frequency: str = Field(max_length=80)


class RecordCreateIn(CamelModel):
    patient_id: str
    type: str
    title: str = Field(min_length=3, max_length=150)
    date: dt.date
    summary: str = Field(min_length=3, max_length=1000)
    labs: Optional[list[LabIn]] = None
    medications: Optional[list[MedicationIn]] = None
    reports_no_medication: bool = False
    extraction: Literal["OCR + manual review", "OCR only", "Structured upload", "Manual entry"] = "Manual entry"
    verification: Literal["reviewed", "pending", "unverified"] = "pending"
    file_name: str = Field(default="entered in hospital system", max_length=200)


class EmergencyIn(CamelModel):
    patient_id: str
    reason: str = Field(min_length=10, max_length=300)

class AiAuditIn(CamelModel):
    patient_id: str
    query: str = Field(min_length=1, max_length=300)