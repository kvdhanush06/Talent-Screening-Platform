"""Talent Screening Platform - FastAPI Application."""

import os
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.status import HTTP_200_OK

from app.config import settings
from app.data_store import JOB_ANALYSIS, JOBS, USERS
from app.api.v1.api import api_router
from app.services.email_service import email_service


# Seed a default recruiter for testing
async def seed_data():
    "" """Seed test data."""""
    if not USERS:
        import uuid
        from app.core.security import get_password_hash
        user_id = str(uuid.uuid4())
        USERS[user_id] = {
            "id": user_id,
            "email": "recruiter@example.com",
            "password_hash": get_password_hash("password123"),
            "full_name": "Test Recruiter",
            "company_name": "Acme Corp",
            "role": "recruiter",
            "is_active": True,
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00",
        }
        # Seed a sample job
        job_id = str(uuid.uuid4())
        JOBS[job_id] = {
            "id": job_id,
            "user_id": user_id,
            "title": "Senior Software Engineer",
            "description": "We are looking for a Senior Software Engineer to join our team. You will build and maintain backend services, work with a modern tech stack (Python, FastAPI, Docker, AWS), and collaborate with cross-functional teams to deliver high-quality software.",
            "department": "Engineering",
            "location": "Remote",
            "employment_type": "full-time",
            "experience_level": "senior",
            "status": "active",
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00",
        }
        JOB_ANALYSIS[job_id] = {
            "job_id": job_id,
            "required_skills": ["Python", "FastAPI", "Docker", "AWS"],
            "preferred_skills": ["Kubernetes", "React", "TypeScript"],
            "experience_required": {"years": 5, "level": "senior"},
            "education_required": "Bachelor's in Computer Science or equivalent",
            "key_responsibilities": [
                "Build and maintain backend services",
                "Design scalable APIs and data models",
                "Collaborate with frontend and product teams",
                "Mentor junior engineers",
            ],
            "soft_skills": ["Leadership", "Communication", "Teamwork", "Problem-solving"],
            "created_at": "2024-01-01T00:00:00",
        }
        print(f"[Seed] Created test user: recruiter@example.com / password123")
        print(f"[Seed] Created test job: Senior Software Engineer")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    await seed_data()
    yield
    print("Shutting down...")


app = FastAPI(
    title="Talent Screening Platform API",
    description="AI-Powered Talent Screening & Interview Intelligence Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static uploads
upload_dir = pathlib.Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)


@app.get("/uploads/{path:path}")
async def serve_upload(path: str):
    file_path = upload_dir / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    return JSONResponse({"error": "File not found"}, status_code=404)

# Health check
@app.get("/health", status_code=HTTP_200_OK)
async def health_check():
    return {"status": "ok", "version": "0.1.0"}

# Root
@app.get("/")
async def root():
    return {"message": "Talent Screening Platform API", "docs": "/docs", "api": "/api/v1"}

# Include API router
app.include_router(api_router, prefix="/api/v1")
