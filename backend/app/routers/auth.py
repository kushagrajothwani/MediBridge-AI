from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.identity import generate_mb_id
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def new_patient_id(db: Session) -> str:
    for _ in range(10):
        candidate = generate_mb_id()
        if not db.query(models.Patient).filter_by(mb_patient_id=candidate).first():
            return candidate
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate patient ID")


def to_user_response(user: models.User) -> schemas.UserResponse:
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        title=user.title,
        hospital_code=user.hospital_id,
        mb_patient_id=user.patient.mb_patient_id if user.patient else None,
    )


@router.post("/register", response_model=schemas.UserResponse, status_code=201)
def register(data: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """Patient self-registration only. Doctor/admin accounts are created by an administrator."""
    email = data.email.lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = models.User(
        email=email,
        full_name=data.full_name.strip(),
        password_hash=hash_password(data.password),
        role="patient",
        title="Patient",
    )
    db.add(user)
    db.flush()
    db.add(
        models.Patient(
            user_id=user.id,
            mb_patient_id=new_patient_id(db),
            dob=data.dob,
            gender=data.gender,
            blood_group=data.blood_group,
        )
    )
    db.commit()
    db.refresh(user)
    return to_user_response(user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username.lower()).first()
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return schemas.TokenResponse(access_token=create_access_token(user.id, user.role))


@router.get("/me", response_model=schemas.UserResponse)
def me(user: models.User = Depends(get_current_user)):
    return to_user_response(user)


# Temporary route that proves role checks work. Remove before release.
@router.get("/doctor-check")
def doctor_check(user: models.User = Depends(require_roles("doctor"))):
    return {"message": f"Hello {user.full_name}, you are allowed here"}