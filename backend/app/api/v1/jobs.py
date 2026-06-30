"""Job management routes."""

import uuid as uuid_mod
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.data_store import JOBS, JOB_ANALYSIS
from app.services.ai_service import ai_service

router = APIRouter()

# Schemas
class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    department: str = ""
    location: str = ""
    employment_type: str = "full-time"
    experience_level: str = "mid"

class JobUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    department: str | None = None
    location: str | None = None
    employment_type: str | None = None
    experience_level: str | None = None
    status: str | None = None

# Routes
@router.post("/")
async def create_job(data: JobCreate, user: dict = Depends(get_current_user)):
    """Create a new job posting."""
    job_id = str(uuid_mod.uuid4())
    job = {
        "id": job_id,
        "user_id": user["id"],
        "title": data.title,
        "description": data.description,
        "department": data.department,
        "location": data.location,
        "employment_type": data.employment_type,
        "experience_level": data.experience_level,
        "status": "draft",
        "created_at": str(datetime.utcnow()),
        "updated_at": str(datetime.utcnow()),
    }
    JOBS[job_id] = job
    return {"status": "success", "job": job}

@router.get("/")
async def list_jobs(
    status: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List all jobs for the current user."""
    results = []
    for j in JOBS.values():
        if j["user_id"] != user["id"]:
            continue
        if status and j.get("status") != status:
            continue
        if department and j.get("department") != department:
            continue
        if search and search.lower() not in j["title"].lower():
            continue
        results.append(j)
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "jobs": results}

@router.get("/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    """Get a specific job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return {"status": "success", "job": job}

@router.put("/{job_id}")
async def update_job(job_id: str, data: JobUpdate, user: dict = Depends(get_current_user)):
    """Update a job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if data.title is not None:
        job["title"] = data.title
    if data.description is not None:
        job["description"] = data.description
    if data.department is not None:
        job["department"] = data.department
    if data.location is not None:
        job["location"] = data.location
    if data.employment_type is not None:
        job["employment_type"] = data.employment_type
    if data.experience_level is not None:
        job["experience_level"] = data.experience_level
    if data.status is not None:
        job["status"] = data.status
    job["updated_at"] = str(datetime.utcnow())
    return {"status": "success", "job": job}

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    """Delete a job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    del JOBS[job_id]
    if job_id in JOB_ANALYSIS:
        del JOB_ANALYSIS[job_id]

@router.post("/{job_id}/analyze")
async def analyze_job(job_id: str, user: dict = Depends(get_current_user)):
    """Analyze a job using AI."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    analysis = await ai_service.analyze_job_description(job["description"])
    JOB_ANALYSIS[job_id] = {
        "job_id": job_id,
        **analysis,
        "created_at": str(datetime.utcnow()),
    }
    return {"status": "success", "analysis": JOB_ANALYSIS[job_id]}

@router.get("/{job_id}/analysis")
async def get_job_analysis(job_id: str, user: dict = Depends(get_current_user)):
    """Get job analysis."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if job_id not in JOB_ANALYSIS:
        return {"status": "pending", "message": "Analysis not yet performed."}
    return {"status": "success", "analysis": JOB_ANALYSIS[job_id]}
