import uuid
from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient

from app import models
from app.database import SessionLocal
from app.main import app
from app.models import utcnow

client = TestClient(app)

DOCTOR_B = ("meera@example.com", "Meera12345")
ADMIN_B = ("admin.b@example.com", "Admin12345")


def login(email, password):
    res = client.post("/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def new_patient():
    email = f"pt_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Test Patient", "role": "patient"},
    )
    assert res.status_code == 201, res.text
    return login(email, "Password123"), res.json()["mb_patient_id"]


def add_record(mb_id, hospital_id="H-A", rtype="lab_report"):
    record_id = f"T-{uuid.uuid4().hex[:10]}"
    db = SessionLocal()
    try:
        patient = db.query(models.Patient).filter_by(mb_patient_id=mb_id).first()
        db.add(models.MedicalRecord(
            id=record_id, patient_id=patient.id, hospital_id=hospital_id, type=rtype,
            title="Test record", record_date=date(2026, 3, 12), summary="Synthetic test record",
            extraction="Manual entry", verification="reviewed",
            uploaded_at=datetime(2026, 3, 12, 11, 0), file_name="test.pdf"))
        db.commit()
    finally:
        db.close()
    return record_id


def request_consent(doctor, mb_id, scope=("lab_report",)):
    res = client.post("/consents/request", headers=doctor,
                      json={"patientId": mb_id, "scope": list(scope), "reason": "Reviewing follow-up results"})
    assert res.status_code == 201, res.text
    return res.json()["id"]


def grant(patient, consent_id):
    res = client.post(f"/consents/{consent_id}/grant", headers=patient, json={"durationDays": 7})
    assert res.status_code == 200, res.text


def test_other_hospital_records_are_locked_without_consent():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    record_id = add_record(mb)

    listing = client.get(f"/patients/{mb}/records", headers=doctor)
    assert listing.status_code == 200
    assert listing.json()["records"] == []
    assert listing.json()["locked"] == [{"hospitalId": "H-A", "type": "lab_report", "date": "2026-03-12"}]

    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 403

    audit = client.get("/audit", headers=patient).json()
    assert any(e["action"] == "access_denied" and e["resource"] == record_id for e in audit)


def test_grant_unlocks_and_revoke_blocks_again():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    record_id = add_record(mb)

    consent_id = request_consent(doctor, mb)
    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 403  # still pending

    grant(patient, consent_id)
    ok = client.get(f"/records/{record_id}", headers=doctor)
    assert ok.status_code == 200
    listing = client.get(f"/patients/{mb}/records", headers=doctor).json()
    assert [r["id"] for r in listing["records"]] == [record_id]
    assert listing["locked"] == []

    audit = client.get("/audit", headers=patient).json()
    assert any(e["action"] == "view_records" and e["resource"] == record_id for e in audit)

    assert client.post(f"/consents/{consent_id}/revoke", headers=patient).status_code == 200
    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 403
    assert client.get(f"/patients/{mb}/records", headers=doctor).json()["records"] == []


def test_consent_scope_is_enforced():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    record_id = add_record(mb, rtype="lab_report")
    consent_id = request_consent(doctor, mb, scope=("prescription",))
    grant(patient, consent_id)
    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 403


def test_expired_consent_blocks_access():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    record_id = add_record(mb)
    consent_id = request_consent(doctor, mb)
    grant(patient, consent_id)
    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 200

    db = SessionLocal()
    try:
        consent = db.get(models.Consent, consent_id)
        consent.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()
    assert client.get(f"/records/{record_id}", headers=doctor).status_code == 403


def test_patient_cannot_read_another_patients_records():
    patient_a, mb_a = new_patient()
    patient_b, _ = new_patient()
    record_id = add_record(mb_a)
    assert client.get(f"/patients/{mb_a}/records", headers=patient_b).status_code == 403
    assert client.get(f"/records/{record_id}", headers=patient_b).status_code == 403
    assert client.get(f"/records/{record_id}", headers=patient_a).status_code == 200


def test_only_the_owning_patient_can_decide():
    doctor = login(*DOCTOR_B)
    patient_a, mb_a = new_patient()
    patient_b, _ = new_patient()
    consent_id = request_consent(doctor, mb_a)
    assert client.post(f"/consents/{consent_id}/grant", headers=patient_b).status_code == 403
    assert client.post(f"/consents/{consent_id}/grant", headers=doctor).status_code == 403


def test_patient_cannot_request_consent():
    patient, mb = new_patient()
    res = client.post("/consents/request", headers=patient,
                      json={"patientId": mb, "scope": ["lab_report"], "reason": "Trying to self-request"})
    assert res.status_code == 403


def test_duplicate_pending_request_is_rejected():
    doctor = login(*DOCTOR_B)
    _, mb = new_patient()
    request_consent(doctor, mb)
    res = client.post("/consents/request", headers=doctor,
                      json={"patientId": mb, "scope": ["lab_report"], "reason": "Second request"})
    assert res.status_code == 409


def test_own_hospital_doctor_needs_no_consent():
    doctor = login(*DOCTOR_B)
    _, mb = new_patient()
    record_id = add_record(mb, hospital_id="H-B", rtype="encounter")
    listing = client.get(f"/patients/{mb}/records", headers=doctor).json()
    assert [r["id"] for r in listing["records"]] == [record_id]


def test_hospital_admin_cannot_read_other_hospital_records():
    admin = login(*ADMIN_B)
    _, mb = new_patient()
    record_id = add_record(mb, hospital_id="H-A")
    listing = client.get(f"/patients/{mb}/records", headers=admin).json()
    assert listing["records"] == []
    assert client.get(f"/records/{record_id}", headers=admin).status_code == 403


def test_search_returns_only_the_patient_shell():
    doctor = login(*DOCTOR_B)
    _, mb = new_patient()
    add_record(mb)
    res = client.get("/patients/search", params={"q": mb}, headers=doctor)
    assert res.status_code == 200
    assert "records" not in res.json()
    assert client.get("/patients/search", params={"q": "MB-0000-0000-0000"}, headers=doctor).status_code == 404
def upload_body(mb_id, **overrides):
    body = {
        "patientId": mb_id, "type": "lab_report", "title": "Blood report: HbA1c",
        "date": "2026-10-10", "summary": "HbA1c 7.0%.",
        "labs": [{"name": "HbA1c", "value": 7.0, "unit": "%", "refLow": 4.0, "refHigh": 5.6}],
        "extraction": "OCR + manual review", "verification": "reviewed", "fileName": "report.pdf",
    }
    body.update(overrides)
    return body


def test_admin_upload_is_visible_to_patient_and_audited():
    admin = login(*ADMIN_B)
    patient, mb = new_patient()
    res = client.post("/records", headers=admin, json=upload_body(mb))
    assert res.status_code == 201, res.text
    assert res.json()["hospitalId"] == "H-B"
    record_id = res.json()["id"]
    assert client.get(f"/records/{record_id}", headers=patient).status_code == 200
    audit = client.get("/audit", headers=patient).json()
    assert any(e["action"] == "record_upload" and e["resource"] == record_id for e in audit)


def test_doctor_and_patient_cannot_upload():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    assert client.post("/records", headers=doctor, json=upload_body(mb)).status_code == 403
    assert client.post("/records", headers=patient, json=upload_body(mb)).status_code == 403


def test_upload_rejects_unknown_record_type():
    admin = login(*ADMIN_B)
    _, mb = new_patient()
    assert client.post("/records", headers=admin, json=upload_body(mb, type="xray")).status_code == 422


def test_emergency_access_is_limited_and_audited():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    allergy_id = add_record(mb, rtype="allergy")
    lab_id = add_record(mb, rtype="lab_report")
    res = client.post("/consents/emergency", headers=doctor,
                      json={"patientId": mb, "reason": "Unconscious patient in emergency room"})
    assert res.status_code == 201, res.text
    assert res.json()["kind"] == "emergency"
    assert client.get(f"/records/{allergy_id}", headers=doctor).status_code == 200
    assert client.get(f"/records/{lab_id}", headers=doctor).status_code == 403
    audit = client.get("/audit", headers=patient).json()
    assert any(e["action"] == "emergency_access" for e in audit)


def test_emergency_requires_a_real_reason():
    doctor = login(*DOCTOR_B)
    _, mb = new_patient()
    res = client.post("/consents/emergency", headers=doctor, json={"patientId": mb, "reason": "urgent"})
    assert res.status_code == 422

def test_locked_attempt_is_logged_and_validated():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    add_record(mb, rtype="lab_report")
    body = {"patientId": mb, "hospitalId": "H-A", "type": "lab_report"}
    assert client.post("/audit/denied", headers=doctor, json=body).status_code == 204
    audit = client.get("/audit", headers=patient).json()
    assert any(e["action"] == "access_denied" for e in audit)
    invented = {"patientId": mb, "hospitalId": "H-A", "type": "allergy"}
    assert client.post("/audit/denied", headers=doctor, json=invented).status_code == 404
    assert client.post("/audit/denied", headers=patient, json=body).status_code == 403


def test_denied_log_rejects_records_the_doctor_may_read():
    doctor = login(*DOCTOR_B)
    patient, mb = new_patient()
    add_record(mb, rtype="lab_report")
    grant(patient, request_consent(doctor, mb))
    body = {"patientId": mb, "hospitalId": "H-A", "type": "lab_report"}
    assert client.post("/audit/denied", headers=doctor, json=body).status_code == 404