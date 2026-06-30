"""Candidate comparison routes."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user as get_current_user_from_token
from app.data_store import JOBS, CANDIDATES, CANDIDATE_SCORES

router = APIRouter()

class CompareRequest(BaseModel):
    candidate_ids: List[str]

@router.post("/jobs/{job_id}/compare")
async def compare_candidates(
    job_id: str,
    req: CompareRequest,
    user: dict = Depends(get_current_user_from_token)
):
    """Compare multiple candidates for a job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    results = []
    for cid in req.candidate_ids:
        if cid not in CANDIDATES:
            continue
        cand = CANDIDATES[cid]
        if cand["job_id"] != job_id:
            continue
        scores = CANDIDATE_SCORES.get(cid, {})
        results.append({
            "candidate": cand,
            "scores": scores,
        })

    # Generate comparison summary
    summary = {
        "job_title": job["title"],
        "total_compared": len(results),
        "highest_scored": None,
        "recommendation": "Review individual candidate details for final selection.",
    }
    if results:
        best = max(results, key=lambda x: x["scores"].get("overall_score", 0) if x["scores"] else 0)
        summary["highest_scored"] = best["candidate"]["name"]

    return {
        "status": "success",
        "comparison": {
            "summary": summary,
            "candidates": results,
        }
    }
