"""Candidate model."""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CandidateStatus(str, PyEnum):
    new = "new"
    screened = "screened"
    shortlisted = "shortlisted"
    rejected = "rejected"
    invited = "invited"
    in_progress = "in_progress"
    completed = "completed"
    hired = "hired"


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    source = Column(String(50), default="manual", nullable=False)
    source_id = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    current_title = Column(String(255), nullable=True)
    current_company = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)  # JSON array
    experience = Column(Text, nullable=True)  # JSON array
    education = Column(Text, nullable=True)  # JSON array
    resume_url = Column(String(500), nullable=True)
    profile_url = Column(String(500), nullable=True)
    match_score = Column(Float, nullable=True)
    is_shortlisted = Column(Boolean, default=False, nullable=False)
    shortlist_reason = Column(Text, nullable=True)
    status = Column(Enum(CandidateStatus), default=CandidateStatus.new, nullable=False)
    confidence_level = Column(String(20), default="medium", nullable=True)
    red_flags = Column(Text, nullable=True)  # JSON array
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
