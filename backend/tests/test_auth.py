import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def unique_email() -> str:
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


def register(role="patient", password="Password123"):
    email = unique_email()
    res = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": "Test User", "role": role},
    )
    return email, res


def login(email, password="Password123"):
    return client.post("/auth/login", data={"username": email, "password": password})


def header(token):
    return {"Authorization": f"Bearer {token}"}


def test_patient_registration_creates_mb_id():
    _, res = register()
    assert res.status_code == 201
    assert res.json()["mb_patient_id"].startswith("MB-")


def test_public_registration_cannot_create_staff():
    _, res = register(role="doctor")
    assert res.status_code == 422


def test_duplicate_email_rejected():
    email, _ = register()
    res = client.post(
        "/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Again", "role": "patient"},
    )
    assert res.status_code == 409


def test_wrong_password_rejected():
    email, _ = register()
    assert login(email, "WrongPassword1").status_code == 401


def test_me_requires_token():
    assert client.get("/auth/me").status_code == 401


def test_patient_cannot_use_doctor_route():
    email, _ = register()
    token = login(email).json()["access_token"]
    assert client.get("/auth/doctor-check", headers=header(token)).status_code == 403


def test_seeded_doctor_can_use_doctor_route():
    token = login("meera@example.com", "Meera12345").json()["access_token"]
    assert client.get("/auth/doctor-check", headers=header(token)).status_code == 200