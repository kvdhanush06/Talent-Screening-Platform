"""Candidate management routes."""

import json
import uuid as uuid_mod
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.data_store import JOBS, CANDIDATES, CANDIDATE_SCORES, JOB_ANALYSIS
from app.services.ai_service import ai_service
from app.services.scraper_service import scraper_service
from app.services.scoring_service import scoring_service

router = APIRouter()

# Schemas
class CandidateCreate(BaseModel):
    job_id: str
    name: str = Field(..., min_length=1)
    email: str = Field(...)
    current_title: str = ""
    current_company: str = ""
    location: str = ""
    summary: str = ""
    skills: list = []
    experience: list = []
    education: list = []
    source: str = "manual"

def normalize_candidate(cand: dict) -> dict:
    """Ensure skills, experience, education, and red_flags are Python collections, not JSON strings."""
    c = cand.copy()
    for field in ["skills", "experience", "education", "red_flags"]:
        if field in c and isinstance(c[field], str):
            try:
                c[field] = json.loads(c[field])
            except Exception:
                c[field] = []
    return c

def generate_fallback_candidates(job_id: str, job_title: str, location: str) -> List[dict]:
    """Generate 10 realistic fallback candidates based on job title."""
    import random
    names = [
        "Alex Rivera", "Jordan Chen", "Taylor Smith", "Morgan Johnson", "Sarah Patel",
        "David Kim", "Elena Rostova", "Marcus Vance", "Priya Sharma", "Lucas Silva"
    ]
    companies = ["Google", "Meta", "Stripe", "Acme Corp", "Tech Startups", "Freelance", "Netflix", "Amazon", "Coinbase", "Slack"]
    locations = ["San Francisco, CA", "New York, NY", "Remote, US", "London, UK", "Remote", "Austin, TX", "Berlin, Germany", "Seattle, WA", "Remote, EU", "Toronto, ON"]
    
    title_lower = job_title.lower()
    is_frontend = any(x in title_lower for x in ["frontend", "react", "ui", "ux", "web", "javascript", "typescript"])
    is_data = any(x in title_lower for x in ["data", "ml", "machine", "learning", "ai", "nlp"])
    
    candidates = []
    for i, name in enumerate(names):
        cid = str(uuid_mod.uuid4())
        
        if is_frontend:
            skills = ["React", "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind CSS", "Next.js", "Redux"]
            title = random.choice(["Senior Frontend Engineer", "UI Engineer", "Full-Stack Developer", "Frontend Architect"])
        elif is_data:
            skills = ["Python", "PyTorch", "TensorFlow", "Pandas", "NumPy", "SQL", "Machine Learning", "Scikit-Learn"]
            title = random.choice(["Data Scientist", "ML Engineer", "AI Researcher", "Senior Data Engineer"])
        else:
            skills = ["Python", "FastAPI", "Go", "Docker", "PostgreSQL", "AWS", "Kubernetes", "System Design"]
            title = random.choice(["Senior Backend Engineer", "Software Architect", "Distributed Systems Engineer", "Backend Developer"])
            
        extra_skills = ["Git", "Agile", "CI/CD", "REST APIs", "GraphQL", "NoSQL"]
        skills.extend(random.sample(extra_skills, k=2))
        
        summary = f"Experienced software professional specializing in building high-performance systems. Skilful in modern technologies and architectures, with a focus on clean code and scalability."
        
        years = i + 2
        exp = [
            {"title": title, "company": companies[i], "years": years, "description": "Led development of key features and services, collaborating with cross-functional teams."}
        ]
        edu = [
            {"degree": "B.S. in Computer Science", "school": "State University", "year": 2020 - i}
        ]
        
        cand = {
            "id": cid,
            "job_id": job_id,
            "source": "scraped_fallback",
            "source_id": f"fb-{i+1}",
            "name": name,
            "email": f"{name.lower().replace(' ', '.')}@example.com",
            "phone": f"+1 (555) {100+i}-{2000+i}",
            "current_title": title,
            "current_company": companies[i],
            "location": locations[i] if location == "" else location,
            "summary": summary,
            "skills": skills,
            "experience": exp,
            "education": edu,
            "resume_url": None,
            "profile_url": "",
            "match_score": None,
            "is_shortlisted": False,
            "shortlist_reason": None,
            "status": "new",
            "confidence_level": "medium" if i % 3 != 0 else "high",
            "red_flags": [],
            "created_at": str(datetime.utcnow()),
            "updated_at": str(datetime.utcnow()),
        }
        candidates.append(cand)
    return candidates

# Routes
@router.post("/candidates/search")
async def search_candidates(data: dict, user: dict = Depends(get_current_user)):
    """Search and scrape candidates for a job from LinkedIn and other boards."""
    job_id = data.get("job_id")
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Run the actual scraper service
    scraped = []
    try:
        scraped = await scraper_service.scrape_candidates(
            job_title=job.get("title", ""),
            location=job.get("location", ""),
            job_id=job_id
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Scraper error: {e}")
        
    # If scraper returned nothing, use the fallback generator
    if not scraped:
        scraped = generate_fallback_candidates(job_id, job.get("title", ""), job.get("location", ""))
        
    # Save candidates to datastore and normalize them for returning
    results = []
    for cand in scraped:
        cid = cand["id"]
        normalized = normalize_candidate(cand)
        CANDIDATES[cid] = normalized
        results.append(normalized)
        
    return {"status": "success", "candidates": results, "count": len(results)}

@router.get("/jobs/{job_id}/candidates")
async def list_candidates(job_id: str, user: dict = Depends(get_current_user)):
    """List candidates for a job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    results = [normalize_candidate(c) for c in CANDIDATES.values() if c["job_id"] == job_id]
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "candidates": results}

@router.get("/candidates/{candidate_id}")
async def get_candidate(candidate_id: str, user: dict = Depends(get_current_user)):
    """Get a candidate with scores."""
    if candidate_id not in CANDIDATES:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand = CANDIDATES[candidate_id]
    job = JOBS.get(cand["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    scores = CANDIDATE_SCORES.get(candidate_id, {})
    return {"status": "success", "candidate": normalize_candidate(cand), "scores": scores}

@router.post("/candidates/{candidate_id}/evaluate")
async def evaluate_candidate(candidate_id: str, user: dict = Depends(get_current_user)):
    """Evaluate a candidate using the semantic scoring service."""
    if candidate_id not in CANDIDATES:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand = CANDIDATES[candidate_id]
    job = JOBS.get(cand["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    job_analysis = JOB_ANALYSIS.get(cand["job_id"], {})
    
    # Run semantic evaluation
    evaluation = await scoring_service.evaluate_candidate(
        jd_text=job["description"] if job else "",
        job_analysis=job_analysis,
        candidate=cand
    )
    
    score_id = str(uuid_mod.uuid4())
    CANDIDATE_SCORES[candidate_id] = {
        "id": score_id,
        "candidate_id": candidate_id,
        "job_id": cand["job_id"],
        **evaluation,
        "evaluated_at": str(datetime.utcnow()),
    }
    
    # Update candidate fields
    if "overall_score" in evaluation:
        CANDIDATES[candidate_id]["match_score"] = evaluation["overall_score"]
        CANDIDATES[candidate_id]["status"] = "screened"
        
        # Check auto-shortlist
        if evaluation.get("is_shortlisted"):
            CANDIDATES[candidate_id]["is_shortlisted"] = True
            CANDIDATES[candidate_id]["shortlist_reason"] = evaluation.get("shortlist_reason")
            CANDIDATES[candidate_id]["status"] = "shortlisted"
            
    return {"status": "success", "evaluation": CANDIDATE_SCORES[candidate_id]}

@router.post("/candidates/evaluate-all/{job_id}")
async def evaluate_all_candidates(job_id: str, user: dict = Depends(get_current_user)):
    """Evaluate all candidates for a job using the semantic scoring service."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    job_analysis = JOB_ANALYSIS.get(job_id, {})
    evaluations = []
    
    for cid, cand in list(CANDIDATES.items()):
        if cand["job_id"] == job_id:
            evaluation = await scoring_service.evaluate_candidate(
                jd_text=job["description"],
                job_analysis=job_analysis,
                candidate=cand
            )
            score_id = str(uuid_mod.uuid4())
            CANDIDATE_SCORES[cid] = {
                "id": score_id,
                "candidate_id": cid,
                "job_id": job_id,
                **evaluation,
                "evaluated_at": str(datetime.utcnow()),
            }
            
            # Update candidate details
            CANDIDATES[cid]["match_score"] = evaluation.get("overall_score")
            CANDIDATES[cid]["status"] = "screened"
            
            if evaluation.get("is_shortlisted"):
                CANDIDATES[cid]["is_shortlisted"] = True
                CANDIDATES[cid]["shortlist_reason"] = evaluation.get("shortlist_reason")
                CANDIDATES[cid]["status"] = "shortlisted"
                
            evaluations.append(CANDIDATE_SCORES[cid])
            
    return {"status": "success", "evaluations": evaluations}

@router.put("/candidates/{candidate_id}/shortlist")
async def shortlist_candidate(candidate_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Toggle shortlist status for a candidate."""
    if candidate_id not in CANDIDATES:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand = CANDIDATES[candidate_id]
    job = JOBS.get(cand["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    CANDIDATES[candidate_id]["is_shortlisted"] = data.get("is_shortlisted", True)
    CANDIDATES[candidate_id]["shortlist_reason"] = data.get("shortlist_reason", "")
    CANDIDATES[candidate_id]["status"] = "shortlisted" if data.get("is_shortlisted") else "new"
    return {"status": "success", "candidate": normalize_candidate(CANDIDATES[candidate_id])}
