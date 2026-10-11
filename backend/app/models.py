import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)  # HOSP-A, HOSP-B

    users = relationship("User", back_populates="hospital")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # patient, doctor, hospital_admin, sys_admin
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hospital = relationship("Hospital", back_populates="users")
    patient = relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    mb_patient_id = Column(String, unique=True, nullable=False)  # MB-PAT-1001
    dob = Column(Date, nullable=True)
    gender = Column(String, nullable=True)

    user = relationship("User", back_populates="patient")