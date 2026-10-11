from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=100)
    role: Literal["patient", "doctor", "hospital_admin"]
    hospital_code: Optional[str] = None  # required for doctor / hospital_admin


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    hospital_code: Optional[str] = None
    mb_patient_id: Optional[str] = None