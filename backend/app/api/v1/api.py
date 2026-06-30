"""Main API router for all v1 routes."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.candidates import router as candidates_router
from app.api.v1.interviews import router as interviews_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.comparison import router as comparison_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth")
api_router.include_router(jobs_router, prefix="/jobs")
api_router.include_router(candidates_router)
api_router.include_router(interviews_router)
api_router.include_router(notifications_router, prefix="/notifications")
api_router.include_router(comparison_router)
