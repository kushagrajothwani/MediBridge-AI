from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def next_patient_id(db: Session) -> str:
    """Creates synthetic IDs: MB-PAT-1001, MB-PAT-1002, ..."""
    count = db.query(models.Patient).count()
    return f"MB-PAT-{1001 + count}"


def to_user_response(user: models.User) -> schemas.UserResponse:
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        hospital_code=user.hospital.code if user.hospital else None,
        mb_patient_id=user.patient.mb_patient_id if user.patient else None,
    )


@router.post("/register", response_model=schemas.UserResponse, status_code=201)
def register(data: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = data.email.lower()

    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    hospital = None
    if data.role in ("doctor", "hospital_admin"):
        if not data.hospital_code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "hospital_code is required")
        hospital = db.query(models.Hospital).filter(
            models.Hospital.code == data.hospital_code
        ).first()
        if hospital is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown hospital_code")

    user = models.User(
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=data.role,
        hospital_id=hospital.id if hospital else None,
    )
    db.add(user)
    db.flush()  # gives user.id without committing yet

    if data.role == "patient":
        db.add(models.Patient(user_id=user.id, mb_patient_id=next_patient_id(db)))

    db.commit()
    db.refresh(user)
    return to_user_response(user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    # The form field is called "username" but we use it for the email
    user = db.query(models.User).filter(
        models.User.email == form.username.lower()
    ).first()

    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Incorrect email or password"
        )

    return schemas.TokenResponse(access_token=create_access_token(user.id, user.role))


@router.get("/me", response_model=schemas.UserResponse)
def me(user: models.User = Depends(get_current_user)):
    return to_user_response(user)


# Temporary route to prove role checks work. We remove it later.
@router.get("/doctor-check")
def doctor_check(user: models.User = Depends(require_roles("doctor"))):
    return {"message": f"Hello Dr. {user.full_name}, you are allowed here"}