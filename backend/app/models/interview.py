"""Interview model."""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class InterviewStatus(str, PyEnum):
    pending = "pending"
    invited = "invited"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    status = Column(Enum(InterviewStatus), default=InterviewStatus.pending, nullable=False)
    invite_token = Column(String(255), unique=True, nullable=True)
    invited_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    current_question = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)  # behavioral, technical, situational, general
    order = Column(Integer, nullable=False)
    think_time_seconds = Column(Integer, default=30, nullable=False)
    time_limit_seconds = Column(Integer, default=180, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Answer(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    video_url = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending, uploaded, error
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    answer_id = Column(UUID(as_uuid=True), ForeignKey("answers.id"), nullable=False)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id"), nullable=False)
    text = Column(Text, nullable=True)
    language = Column(String(10), default="en", nullable=True)
    segments = Column(Text, nullable=True)  # JSON array of timestamped segments
    word_count = Column(Integer, nullable=True)
    filler_word_count = Column(Integer, nullable=True)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Scorecard(Base):
    __tablename__ = "scorecards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    overall_score = Column(Float, nullable=True)
    relevance_score = Column(Float, nullable=True)
    clarity_score = Column(Float, nullable=True)
    specificity_score = Column(Float, nullable=True)
    depth_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    problem_solving_score = Column(Float, nullable=True)
    cultural_fit_score = Column(Float, nullable=True)
    recommendation = Column(String(50), nullable=True)  # strong_yes, yes, maybe, no
    confidence = Column(String(20), nullable=True)  # high, medium, low
    strengths = Column(Text, nullable=True)  # JSON array
    weaknesses = Column(Text, nullable=True)  # JSON array
    per_question_scores = Column(Text, nullable=True)  # JSON array
    follow_up_questions = Column(Text, nullable=True)  # JSON array
    summary = Column(Text, nullable=True)
    raw_evaluation = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
