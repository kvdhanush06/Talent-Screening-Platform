"""Interview management routes — recruiter-facing and candidate-facing."""

import asyncio
import json
import logging
import uuid as uuid_mod
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.data_store import (
    JOBS, CANDIDATES, INTERVIEWS, QUESTIONS, ANSWERS, TRANSCRIPTS, SCORECARDS, CANDIDATE_SCORES
)
from app.services.ai_service import ai_service
from app.services.email_service import email_service
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Schemas ---

class InterviewCreate(BaseModel):
    job_id: str
    candidate_id: str

class AnswerSubmit(BaseModel):
    question_id: str
    duration_seconds: int = 0

class ChunkComplete(BaseModel):
    upload_id: str
    question_id: str
    total_chunks: int

class InviteRequest(BaseModel):
    candidate_id: str


# --- Background Transcription Task Helper ---

async def transcribe_answer_task(answer_id: str, video_path: str):
    """Background task to run audio extraction and Whisper transcription."""
    try:
        logger.info(f"Background transcription started for answer {answer_id}...")
        result = await transcription_service.transcribe_video(video_path)
        
        # Save transcript to store
        TRANSCRIPTS[answer_id] = {
            "id": str(uuid_mod.uuid4()),
            "answer_id": answer_id,
            "interview_id": ANSWERS[answer_id]["interview_id"],
            "text": result.get("text", ""),
            "language": result.get("language", "en"),
            "confidence_score": result.get("confidence_score", 0.0),
            "word_count": result.get("word_count", 0),
            "filler_word_count": result.get("filler_word_count", 0),
            "segments": result.get("segments", []),
            "processing_time_ms": int(result.get("processing_time", 0.0) * 1000),
            "created_at": str(datetime.utcnow()),
        }
        
        if answer_id in ANSWERS:
            ANSWERS[answer_id]["transcript"] = result.get("text", "")
            ANSWERS[answer_id]["status"] = "uploaded"
            
        logger.info(f"Background transcription successfully completed for answer {answer_id}.")
    except Exception as e:
        logger.error(f"Background transcription task failed for answer {answer_id}: {e}")


# --- Scorecard Generation Helper ---

async def generate_scorecard_data(interview_id: str, job_id: str) -> dict:
    """Generate aggregate scorecard data for an interview."""
    interview_answers = [a for a in ANSWERS.values() if a["interview_id"] == interview_id]
    job = JOBS.get(job_id)
    jd_desc = job.get("description", "") if job else ""
    
    qa_pairs = []
    per_question_scores = []
    total_relevance = 0
    total_clarity = 0
    total_specificity = 0
    total_depth = 0
    total_q_score = 0
    count = 0

    for answer in interview_answers:
        question = QUESTIONS.get(answer["question_id"], {})
        transcript = TRANSCRIPTS.get(answer["id"])
        
        # Safe fallback: run transcription now if not ready
        if not transcript:
            try:
                video_abs_path = str(storage_service.get_file_path(answer["video_url"]))
                result = await transcription_service.transcribe_video(video_abs_path)
                transcript = {
                    "id": str(uuid_mod.uuid4()),
                    "answer_id": answer["id"],
                    "interview_id": interview_id,
                    "text": result.get("text", ""),
                    "language": result.get("language", "en"),
                    "confidence_score": result.get("confidence_score", 0.0),
                    "word_count": result.get("word_count", 0),
                    "filler_word_count": result.get("filler_word_count", 0),
                    "segments": result.get("segments", []),
                    "processing_time_ms": int(result.get("processing_time", 0.0) * 1000),
                    "created_at": str(datetime.utcnow()),
                }
                TRANSCRIPTS[answer["id"]] = transcript
                answer["transcript"] = result.get("text", "")
                answer["status"] = "uploaded"
            except Exception as ex:
                logger.error(f"On-demand transcription failed for answer {answer['id']}: {ex}")
                transcript = {"text": "No transcript available."}

        transcript_text = transcript.get("text", "")
        qa_pairs.append({
            "question": question.get("question_text", ""),
            "question_type": question.get("question_type", ""),
            "answer_text": transcript_text,
            "duration": answer.get("duration_seconds", 0),
        })
        
        # Analyze answer dimensions (relevance, clarity, specificity, depth)
        analysis = await transcription_service.analyze_answer(
            question_text=question.get("question_text", ""),
            answer_text=transcript_text,
            jd_context=jd_desc
        )
        
        per_question_scores.append({
            "question_id": answer["question_id"],
            "question_text": question.get("question_text", ""),
            "answer_text": transcript_text,
            "relevance_score": analysis["relevance_score"],
            "clarity_score": analysis["clarity_score"],
            "specificity_score": analysis["specificity_score"],
            "depth_score": analysis["depth_score"],
            "overall_score": analysis["overall_score"],
            "summary": analysis["answer_summary"],
            "feedback": analysis["feedback"],
        })
        
        total_relevance += analysis["relevance_score"]
        total_clarity += analysis["clarity_score"]
        total_specificity += analysis["specificity_score"]
        total_depth += analysis["depth_score"]
        total_q_score += analysis["overall_score"]
        count += 1

    # Averages
    avg_relevance = round(total_relevance / max(count, 1), 1)
    avg_clarity = round(total_clarity / max(count, 1), 1)
    avg_specificity = round(total_specificity / max(count, 1), 1)
    avg_depth = round(total_depth / max(count, 1), 1)
    avg_q_score = round(total_q_score / max(count, 1), 1)

    # Ollama evaluation for higher-level feedback
    ai_evaluation = {}
    try:
        ai_evaluation = await ai_service.evaluate_transcript(json.dumps(qa_pairs))
    except Exception as e:
        logger.error(f"AI transcript evaluation failed: {e}")

    # Generate follow-up questions
    follow_ups = []
    try:
        follow_ups = await ai_service.generate_follow_up(qa_pairs)
        if follow_ups and isinstance(follow_ups, list):
            if isinstance(follow_ups[0], dict):
                follow_ups = [q.get("question_text", q.get("question", "")) for q in follow_ups]
    except Exception as e:
        logger.error(f"Follow up questions generation failed: {e}")
        follow_ups = ["Can you elaborate on your experience?"]

    scorecard_id = str(uuid_mod.uuid4())
    return {
        "id": scorecard_id,
        "interview_id": interview_id,
        "candidate_id": INTERVIEWS[interview_id]["candidate_id"],
        "job_id": job_id,
        "overall_score": ai_evaluation.get("overall_score") or avg_q_score,
        "relevance_score": avg_relevance,
        "clarity_score": avg_clarity,
        "specificity_score": avg_specificity,
        "depth_score": avg_depth,
        "communication_score": ai_evaluation.get("communication_score") or avg_clarity,
        "technical_score": ai_evaluation.get("technical_score") or avg_depth,
        "problem_solving_score": ai_evaluation.get("problem_solving_score") or avg_q_score,
        "cultural_fit_score": ai_evaluation.get("cultural_fit_score") or 65.0,
        "recommendation": ai_evaluation.get("recommendation", "maybe"),
        "confidence": ai_evaluation.get("confidence", "medium"),
        "strengths": ai_evaluation.get("strengths", ["Clear communication", "Relevance to requirements"]),
        "weaknesses": ai_evaluation.get("weaknesses", ["Could provide more technical depth"]),
        "per_question_scores": per_question_scores,
        "follow_up_questions": follow_ups,
        "summary": ai_evaluation.get("summary", "The candidate completed the async video interview. Overall communication and technical alignment were evaluated."),
        "created_at": str(datetime.utcnow()),
        "updated_at": str(datetime.utcnow()),
    }


# --- Recruiter-Facing Routes ---

@router.post("/interviews")
async def create_interview(data: InterviewCreate, user: dict = Depends(get_current_user)):
    """Create a new interview for a candidate and send invitation."""
    job_id = data.job_id
    candidate_id = data.candidate_id

    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    if job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if candidate_id not in CANDIDATES:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate = CANDIDATES[candidate_id]

    interview_id = str(uuid_mod.uuid4())
    invite_token = str(uuid_mod.uuid4()).replace("-", "")[:16]

    INTERVIEWS[interview_id] = {
        "id": interview_id,
        "job_id": job_id,
        "candidate_id": candidate_id,
        "candidate_name": candidate.get("name", ""),
        "job_title": job.get("title", ""),
        "status": "invited",
        "invite_token": invite_token,
        "invited_at": str(datetime.utcnow()),
        "started_at": None,
        "completed_at": None,
        "current_question": 0,
        "total_questions": 0,
        "created_at": str(datetime.utcnow()),
        "updated_at": str(datetime.utcnow()),
    }

    # Generate interview link
    interview_link = f"talentscreen://interview/{invite_token}"
    web_fallback = f"https://talentscreening.app/interview/{invite_token}"

    # Send invitation email
    await email_service.send_interview_invitation(
        to_email=candidate.get("email", ""),
        candidate_name=candidate.get("name", "Candidate"),
        job_title=job.get("title", "Position"),
        company_name=user.get("company_name", "Company"),
        interview_link=interview_link,
    )

    # Update candidate status
    CANDIDATES[candidate_id]["status"] = "invited"

    return {
        "status": "success",
        "interview": INTERVIEWS[interview_id],
        "invite_link": interview_link,
        "web_fallback": web_fallback,
    }

@router.get("/interviews")
async def list_interviews(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List interviews for the current user's jobs."""
    results = []
    for i in INTERVIEWS.values():
        job = JOBS.get(i["job_id"])
        if job and job["user_id"] == user["id"]:
            if status and i.get("status") != status:
                continue
            results.append(i)
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "interviews": results}

@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: str, user: dict = Depends(get_current_user)):
    """Get interview details."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    questions_list = [q for q in QUESTIONS.values() if q["interview_id"] == interview_id]
    questions_list.sort(key=lambda x: x["order"])

    return {
        "status": "success",
        "interview": interview,
        "questions": questions_list,
    }

@router.post("/interviews/{interview_id}/questions")
async def generate_questions(interview_id: str, user: dict = Depends(get_current_user)):
    """Generate AI-powered interview questions based on job and candidate profile."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    candidate = CANDIDATES.get(interview["candidate_id"])
    jd_text = job.get("description", "") if job else ""
    candidate_data = candidate if candidate else {}

    # Use AI to generate candidate-specific questions
    ai_questions = await ai_service.generate_interview_questions(
        jd_text=jd_text,
        candidate_data=candidate_data,
        num_questions=5,
    )

    # Clear existing questions
    existing = [q_id for q_id, q in QUESTIONS.items() if q["interview_id"] == interview_id]
    for q_id in existing:
        del QUESTIONS[q_id]

    questions_list = []
    for i, q in enumerate(ai_questions):
        q_id = str(uuid_mod.uuid4())
        question_text = q.get("question_text", q.get("question", f"Question {i+1}"))
        question_type = q.get("question_type", "general")
        think_time = q.get("think_time_seconds", 30)
        time_limit = q.get("time_limit_seconds", 180)

        QUESTIONS[q_id] = {
            "id": q_id,
            "interview_id": interview_id,
            "question_text": question_text,
            "question_type": question_type,
            "order": i + 1,
            "think_time_seconds": think_time,
            "time_limit_seconds": time_limit,
            "created_at": str(datetime.utcnow()),
        }
        questions_list.append(QUESTIONS[q_id])

    INTERVIEWS[interview_id]["total_questions"] = len(questions_list)
    INTERVIEWS[interview_id]["current_question"] = 0
    INTERVIEWS[interview_id]["updated_at"] = str(datetime.utcnow())

    return {"status": "success", "questions": questions_list}

@router.get("/interviews/{interview_id}/scorecard")
async def get_scorecard(interview_id: str, user: dict = Depends(get_current_user)):
    """Get interview scorecard."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    scorecard = SCORECARDS.get(interview_id, {})
    return {
        "status": "success",
        "scorecard": scorecard if scorecard else None,
    }

@router.get("/interviews/{interview_id}/transcript")
async def get_transcript(interview_id: str, user: dict = Depends(get_current_user)):
    """Get interview transcript."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    transcripts = [t for t in TRANSCRIPTS.values() if t["interview_id"] == interview_id]
    return {"status": "success", "transcripts": transcripts}

@router.post("/interviews/{interview_id}/complete")
async def complete_interview(interview_id: str, user: dict = Depends(get_current_user)):
    """Complete an interview (recruiter manually finishes or runs pipeline) and generate scorecard."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    scorecard = await generate_scorecard_data(interview_id, interview["job_id"])
    SCORECARDS[interview_id] = scorecard

    INTERVIEWS[interview_id]["status"] = "completed"
    INTERVIEWS[interview_id]["completed_at"] = str(datetime.utcnow())
    INTERVIEWS[interview_id]["updated_at"] = str(datetime.utcnow())

    if interview["candidate_id"] in CANDIDATES:
        CANDIDATES[interview["candidate_id"]]["status"] = "completed"

    return {"status": "success", "scorecard": scorecard}

@router.put("/interviews/{interview_id}/status")
async def update_interview_status(interview_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update interview status."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    interview["status"] = data.get("status", interview["status"])
    interview["updated_at"] = str(datetime.utcnow())
    return {"status": "success", "interview": interview}


# --- Candidate-Facing Routes (no JWT, uses invite_token) ---

@router.get("/interviews/candidate/{invite_token}")
async def get_interview_by_token(invite_token: str):
    """Get interview details by invite token (for mobile app)."""
    for i_id, i in INTERVIEWS.items():
        if i.get("invite_token") == invite_token:
            questions_list = [q for q in QUESTIONS.values() if q["interview_id"] == i_id]
            questions_list.sort(key=lambda x: x["order"])
            return {
                "status": "success",
                "interview": i,
                "questions": questions_list,
            }
    raise HTTPException(status_code=404, detail="Interview not found or link expired")

@router.post("/interviews/candidate/{invite_token}/start")
async def start_interview(invite_token: str):
    """Start an interview by invite token."""
    for i_id, i in INTERVIEWS.items():
        if i.get("invite_token") == invite_token:
            if i["status"] not in ("invited", "pending"):
                # Allow resuming if in_progress
                if i["status"] == "in_progress":
                    return {"status": "success", "interview": i}
                raise HTTPException(status_code=400, detail="Interview already completed or expired")
            i["status"] = "in_progress"
            i["started_at"] = str(datetime.utcnow())
            i["updated_at"] = str(datetime.utcnow())
            return {"status": "success", "interview": i}
    raise HTTPException(status_code=404, detail="Interview not found")

@router.post("/interviews/candidate/{invite_token}/answers")
async def submit_answer(
    invite_token: str,
    video: UploadFile = File(...),
    question_id: str = Form(...),
    duration_seconds: int = Form(0),
):
    """Submit a video answer for a question directly."""
    interview_id = None
    for i_id, i in INTERVIEWS.items():
        if i.get("invite_token") == invite_token:
            interview_id = i_id
            break

    if not interview_id:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = INTERVIEWS[interview_id]
    if interview["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Interview not in progress")

    # Save video
    video_bytes = await video.read()
    video_path = await storage_service.upload_video(
        file_bytes=video_bytes,
        interview_id=interview_id,
        question_id=question_id,
        filename=video.filename or "video.mp4",
    )

    answer_id = str(uuid_mod.uuid4())
    ANSWERS[answer_id] = {
        "id": answer_id,
        "interview_id": interview_id,
        "question_id": question_id,
        "video_url": video_path,
        "duration_seconds": duration_seconds,
        "status": "uploaded",
        "created_at": str(datetime.utcnow()),
    }

    # Advance current question index
    interview["current_question"] = min(
        interview["current_question"] + 1,
        interview["total_questions"]
    )
    interview["updated_at"] = str(datetime.utcnow())

    # Launch background transcription task
    video_abs_path = str(storage_service.get_file_path(video_path))
    asyncio.create_task(transcribe_answer_task(answer_id, video_abs_path))

    return {
        "status": "success",
        "answer": ANSWERS[answer_id],
        "progress": {
            "current": interview["current_question"],
            "total": interview["total_questions"],
        },
    }

# --- Candidate-Facing Chunked Upload Endpoints ---

_chunk_store: dict = {}  # upload_id -> { chunks: dict, total: int, question_id, interview_id }

@router.post("/interviews/candidate/{invite_token}/answers/upload-chunk")
async def candidate_upload_chunk(
    invite_token: str,
    chunk: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    upload_id: str = Form(...),
    question_id: str = Form(...),
):
    """Upload a single chunk of a video file for a candidate using their invite token."""
    interview_id = None
    for i_id, i in INTERVIEWS.items():
        if i.get("invite_token") == invite_token:
            interview_id = i_id
            break

    if not interview_id:
        raise HTTPException(status_code=404, detail="Interview not found")

    if upload_id not in _chunk_store:
        _chunk_store[upload_id] = {
            "chunks": {},
            "total": total_chunks,
            "interview_id": interview_id,
            "question_id": question_id,
        }

    _chunk_store[upload_id]["chunks"][chunk_index] = chunk
    is_complete = len(_chunk_store[upload_id]["chunks"]) >= total_chunks

    if is_complete:
        # Reassemble chunks
        import base64
        full_data = b""
        for i in range(total_chunks):
            chunk_data = _chunk_store[upload_id]["chunks"].get(i, "")
            if chunk_data:
                try:
                    full_data += base64.b64decode(chunk_data)
                except Exception:
                    full_data += chunk_data.encode()

        # Save assembled video
        video_path = await storage_service.upload_video(
            file_bytes=full_data,
            interview_id=interview_id,
            question_id=question_id,
            filename=f"chunked_{upload_id}.mp4",
        )

        answer_id = str(uuid_mod.uuid4())
        ANSWERS[answer_id] = {
            "id": answer_id,
            "interview_id": interview_id,
            "question_id": question_id,
            "video_url": video_path,
            "duration_seconds": 0,
            "status": "uploaded",
            "created_at": str(datetime.utcnow()),
        }

        # Clean up chunk store
        del _chunk_store[upload_id]

        # Trigger background transcription task
        video_abs_path = str(storage_service.get_file_path(video_path))
        asyncio.create_task(transcribe_answer_task(answer_id, video_abs_path))

        # Update interview progress
        interview = INTERVIEWS[interview_id]
        interview["current_question"] = min(
            interview["current_question"] + 1,
            interview["total_questions"]
        )
        interview["updated_at"] = str(datetime.utcnow())

        return {
            "status": "success",
            "status_text": "complete",
            "video_url": video_path,
            "answer_id": answer_id,
        }

    return {"status": "success", "status_text": "chunk_received", "chunk_index": chunk_index}

@router.post("/interviews/candidate/{invite_token}/answers/complete-upload")
async def candidate_complete_chunked_upload(
    invite_token: str,
    data: ChunkComplete,
):
    """Finalize a chunked upload for a candidate using their invite token."""
    upload_id = data.upload_id
    if upload_id in _chunk_store:
        upload_data = _chunk_store[upload_id]
        total = upload_data["total"]
        received = len(upload_data["chunks"])

        if received < total:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "detail": f"Missing chunks: {received}/{total}"},
            )

    return {"status": "success", "video_url": None}

@router.post("/interviews/candidate/{invite_token}/complete")
async def candidate_complete_interview(invite_token: str):
    """Complete an interview by invite token (called from mobile app)."""
    interview_id = None
    for i_id, i in INTERVIEWS.items():
        if i.get("invite_token") == invite_token:
            interview_id = i_id
            break

    if not interview_id:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = INTERVIEWS[interview_id]
    if interview["status"] == "completed":
        # Scorecard already exists, return it
        scorecard = SCORECARDS.get(interview_id, {})
        return {"status": "success", "scorecard": scorecard}

    # Generate scorecard (transcribes missing answers and evaluates aggregate scorecard)
    scorecard = await generate_scorecard_data(interview_id, interview["job_id"])
    SCORECARDS[interview_id] = scorecard

    # Update statuses
    interview["status"] = "completed"
    interview["completed_at"] = str(datetime.utcnow())
    interview["updated_at"] = str(datetime.utcnow())

    if interview["candidate_id"] in CANDIDATES:
        CANDIDATES[interview["candidate_id"]]["status"] = "completed"

    return {"status": "success", "scorecard": scorecard}


# --- Recruiter-Auth Chunked Upload Fallbacks (for web client or testing compatibility) ---

@router.post("/interviews/{interview_id}/answers/upload-chunk")
async def upload_chunk(
    interview_id: str,
    chunk: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    upload_id: str = Form(...),
    question_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """Upload a chunk of a video (fallback / compatibility version for recruiter endpoints)."""
    if upload_id not in _chunk_store:
        _chunk_store[upload_id] = {
            "chunks": {},
            "total": total_chunks,
            "interview_id": interview_id,
            "question_id": question_id,
        }

    _chunk_store[upload_id]["chunks"][chunk_index] = chunk
    is_complete = len(_chunk_store[upload_id]["chunks"]) >= total_chunks

    if is_complete:
        import base64
        full_data = b""
        for i in range(total_chunks):
            chunk_data = _chunk_store[upload_id]["chunks"].get(i, "")
            if chunk_data:
                try:
                    full_data += base64.b64decode(chunk_data)
                except Exception:
                    full_data += chunk_data.encode()

        video_path = await storage_service.upload_video(
            file_bytes=full_data,
            interview_id=interview_id,
            question_id=question_id,
            filename=f"chunked_{upload_id}.mp4",
        )

        answer_id = str(uuid_mod.uuid4())
        ANSWERS[answer_id] = {
            "id": answer_id,
            "interview_id": interview_id,
            "question_id": question_id,
            "video_url": video_path,
            "duration_seconds": 0,
            "status": "uploaded",
            "created_at": str(datetime.utcnow()),
        }

        del _chunk_store[upload_id]

        # Trigger background transcription task
        video_abs_path = str(storage_service.get_file_path(video_path))
        asyncio.create_task(transcribe_answer_task(answer_id, video_abs_path))

        interview = INTERVIEWS[interview_id]
        interview["current_question"] = min(
            interview["current_question"] + 1,
            interview["total_questions"]
        )
        interview["updated_at"] = str(datetime.utcnow())

        return {
            "status": "success",
            "status_text": "complete",
            "video_url": video_path,
            "answer_id": answer_id,
        }

    return {"status": "success", "status_text": "chunk_received", "chunk_index": chunk_index}

@router.post("/interviews/{interview_id}/answers/complete-upload")
async def complete_chunked_upload(
    interview_id: str,
    data: ChunkComplete,
    user: dict = Depends(get_current_user),
):
    """Finalize chunked upload (compatibility version)."""
    upload_id = data.upload_id
    if upload_id in _chunk_store:
        upload_data = _chunk_store[upload_id]
        total = upload_data["total"]
        received = len(upload_data["chunks"])

        if received < total:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "detail": f"Missing chunks: {received}/{total}"},
            )

    return {"status": "success", "video_url": None}


# --- Invitation Route (from recruiter) ---

@router.post("/interviews/{interview_id}/send-invitation")
async def send_invitation(interview_id: str, user: dict = Depends(get_current_user)):
    """Send interview invitation email."""
    if interview_id not in INTERVIEWS:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = INTERVIEWS[interview_id]
    job = JOBS.get(interview["job_id"])
    if job and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    candidate = CANDIDATES.get(interview["candidate_id"])
    invite_token = interview.get("invite_token", "")
    
    # We use web fallback or talentscreen deep link
    # For email recipients, the web fallback URL is the most readable and clickable
    interview_link = f"http://localhost:5173/interview/{invite_token}"

    sent = await email_service.send_interview_invitation(
        to_email=candidate.get("email", "") if candidate else "",
        candidate_name=candidate.get("name", "Candidate") if candidate else "Candidate",
        job_title=job.get("title", "Position") if job else "Position",
        company_name=user.get("company_name", "Company"),
        interview_link=interview_link,
    )

    if sent:
        interview["status"] = "invited"
        interview["invited_at"] = str(datetime.utcnow())
        interview["updated_at"] = str(datetime.utcnow())

    return {
        "status": "success",
        "email_sent": sent,
        "invite_link": interview_link,
    }
