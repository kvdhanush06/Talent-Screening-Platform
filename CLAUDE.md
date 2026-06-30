# CLAUDE.md

> Project: AI-Powered Talent Screening & Interview Intelligence Platform (MVP)

> This document is the single source of truth for Claude Code while developing this project.

## 1. Project Goal

Build an MVP that demonstrates the complete hiring workflow:

1. Recruiter logs in.
2. Recruiter creates a Job Description.
3. Ollama analyzes the JD into structured requirements.
4. TinyFish Search API retrieves candidate profile results.
5. Candidates are parsed and stored.
6. Ollama evaluates each candidate against the JD and generates structured scores.
7. Recruiter shortlists candidates.
8. Recruiter sends interview invitations.
9. Candidate completes an async interview in the Expo Android app.
10. Videos are uploaded.
11. Faster-Whisper transcribes answers.
12. Ollama evaluates transcripts and generates scorecards.
13. Recruiter compares candidates.

The focus is an end-to-end working product, not enterprise-scale completeness.

---

## 2. Technology Stack

### Backend
- Python 3.12
- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis
- ARQ
- JWT
- Passlib + bcrypt
- Pydantic v2

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- React Hook Form
- Zod
- Axios
- TanStack Table
- Recharts
- Lucide

### Mobile
- Expo
- React Native
- Expo Router
- expo-camera
- expo-av
- expo-file-system
- expo-secure-store

### AI
- Ollama (Qwen3 model)
- Faster-Whisper
- TinyFish Search API

### Storage
- Supabase Storage

### Email
- Nodemailer + Gmail SMTP

---

## 3. Project Structure

talent-screening-platform/
- backend/
- frontend/
- mobile/
- docs/
- README.md

Backend modules:
- auth
- users
- jobs
- candidates
- interviews
- ai
- email
- storage
- websocket
- database

---

## 4. Core Features

- Recruiter authentication
- Job CRUD
- JD AI analysis
- Candidate retrieval
- Candidate semantic evaluation
- Automatic shortlist
- Manual override
- Interview invitation
- Candidate Android interview
- Chunked upload
- Whisper transcription
- AI scorecard
- Candidate comparison

---

## 5. Database (Initial)

Tables:
- users
- jobs
- job_analysis
- candidates
- candidate_scores
- interviews
- questions
- answers
- transcripts
- scorecards

---

## 6. AI Responsibilities

Use Ollama for:
- JD analysis
- Candidate evaluation
- Interview question generation
- Transcript evaluation
- Scorecard generation
- Follow-up questions

Always request strict JSON outputs.

---

## 7. Development Rules

- Build incrementally.
- Finish one feature before starting another.
- Keep code modular.
- Prefer simple solutions over abstractions.
- Do not add unnecessary libraries.
- Avoid premature optimization.
- Every milestone should leave the application runnable.

---

## 8. Milestones

1. Repository setup
2. Backend foundation
3. Authentication
4. Job module
5. JD analysis
6. Candidate retrieval
7. Candidate scoring
8. Dashboard
9. Interview module
10. Expo app
11. Uploads
12. Whisper
13. Scorecards
14. Candidate comparison
15. Deployment
16. Documentation

---

## 9. Definition of Done

The project is complete when:
- Recruiter can create jobs.
- AI analyzes jobs.
- Candidates are retrieved and scored.
- Recruiter shortlists candidates.
- Candidate completes interview.
- Transcript is generated.
- Scorecard is produced.
- Candidates can be compared.
- Backend, frontend, and mobile app run successfully.

---

## 10. Notes for Claude Code

- Never rewrite working code unnecessarily.
- Preserve architecture consistency.
- Ask for clarification before making major architectural changes.
- Prefer small commits and isolated changes.
- Update README when introducing new setup requirements.
