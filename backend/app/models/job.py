"""Job model."""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class JobStatus(str, PyEnum):
    draft = "draft"
    active = "active"
    closed = "closed"
    on_hold = "on_hold"


class EmploymentType(str, PyEnum):
    full_time = "full-time"
    part_time = "part-time"
    contract = "contract"
    internship = "internship"
    temporary = "temporary"


class ExperienceLevel(str, PyEnum):
    entry = "entry"
    mid = "mid"
    senior = "senior"
    lead = "lead"
    executive = "executive"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    department = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    employment_type = Column(Enum(EmploymentType), default=EmploymentType.full_time, nullable=False)
    experience_level = Column(Enum(ExperienceLevel), default=ExperienceLevel.mid, nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.draft, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class JobAnalysis(Base):
    """Structured analysis of a job description."""
    __tablename__ = "job_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False, unique=True)
    required_skills = Column(Text, nullable=True)  # JSON array
    preferred_skills = Column(Text, nullable=True)  # JSON array
    experience_required = Column(Text, nullable=True)  # JSON
    education_required = Column(Text, nullable=True)
    key_responsibilities = Column(Text, nullable=True)  # JSON array
    soft_skills = Column(Text, nullable=True)  # JSON array
    implicit_requirements = Column(Text, nullable=True)  # JSON array
    raw_analysis = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
