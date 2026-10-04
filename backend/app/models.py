import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="hospital")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hospital = relationship("Hospital", back_populates="users")