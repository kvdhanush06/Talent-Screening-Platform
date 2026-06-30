"""AI Service - Interface to Groq and Ollama with high-fidelity mock fallbacks."""

import json
import logging
import os
import time
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI operations using Groq, Ollama, or Mock Fallback."""

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.available = self._check_available()

    def _check_available(self) -> bool:
        """Check if local Ollama is running."""
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=3.0)
            return response.status_code == 200
        except Exception:
            return False

    async def _call_llm(self, prompt: str, expect_json: bool = True) -> dict:
        """Call Groq (primary) or Ollama (secondary) based on environment availability."""
        # 1. Try Groq if API Key is provided
        if settings.GROQ_API_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                body = {
                    "model": settings.GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a senior technical recruiter and talent screening assistant. Always return response in JSON format matching the requested structure."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.1
                }
                if expect_json:
                    body["response_format"] = {"type": "json_object"}

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        json=body,
                        headers=headers,
                        timeout=30.0
                    )
                    response.raise_for_status()
                    result = response.json()
                    content = result["choices"][0]["message"]["content"].strip()

                    if expect_json:
                        try:
                            return json.loads(content)
                        except (json.JSONDecodeError, ValueError):
                            # Handle model returning markdown block wrappers
                            if "```json" in content:
                                content = content.split("```json")[1].split("```")[0].strip()
                                return json.loads(content)
                            return {"response": content}
                    return {"response": content}
            except Exception as e:
                logger.error(f"Groq API call failed: {e}. Falling back...")

        # 2. Try Ollama if available
        if self.available:
            try:
                body = {
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                }
                if expect_json:
                    body["format"] = "json"
                async with httpx.AsyncClient() as client:
                    response = await client.post(f"{self.base_url}/api/generate", json=body, timeout=60.0)
                    response.raise_for_status()
                    data = response.json()
                    answer = data.get("response", "")
                    if expect_json:
                        try:
                            return json.loads(answer)
                        except (json.JSONDecodeError, ValueError):
                            return {"response": answer}
                    return {"response": answer}
            except Exception as e:
                logger.error(f"Ollama call failed: {e}")

        # 3. Signal that no LLM service was reached
        return {"error": "No LLM service available"}

    async def analyze_job_description(self, jd_text: str) -> dict:
        """Analyze a job description extracting structured requirements."""
        if not settings.GROQ_API_KEY and not self.available:
            return self._mock_jd_analysis(jd_text)

        prompt = f"""Analyze this job description and extract structured requirements.

Job Description: {jd_text[:3000]}

Return valid JSON with these exact fields:
{{
  "required_skills": ["skill1", "skill2", ...],
  "preferred_skills": ["skill1", "skill2", ...],
  "experience_required": {{"years": 3, "level": "mid"}},
  "education_required": "string description",
  "key_responsibilities": ["responsibility1", ...],
  "soft_skills": ["skill1", ...],
  "implicit_requirements": [
    {{
      "signal": "fast-paced environment",
      "interpretation": "Startup tolerance — candidate should thrive in ambiguous, rapid-change settings",
      "relevance": "high|medium|low"
    }}
  ],
  "role_level": "junior|mid|senior|lead|executive",
  "seniority_indicators": ["signal1", "signal2", ...],
  "domain_experience": ["domain1", "domain2", ...]
}}

IMPORTANT: Identify implicit requirements from phrases like:
- "fast-paced" or "rapidly changing" -> startup/ambiguity tolerance
- "stakeholder management" or "cross-functional" -> needs senior communication skills
- "wear many hats" -> generalist/startup fit
- "self-starter" or "independent" -> low supervision needed
- "matrix organization" -> complex reporting structure experience
- "global" or "international" -> cross-cultural experience
"""
        res = await self._call_llm(prompt)
        if "error" in res:
            return self._mock_jd_analysis(jd_text)
        return res

    def _mock_jd_analysis(self, jd_text: str = "") -> dict:
        """Return comprehensive mock JD analysis."""
        jd_lower = jd_text.lower()
        implicit = []
        if "fast-paced" in jd_lower or "rapidly" in jd_lower or "dynamic" in jd_lower:
            implicit.append({
                "signal": "fast-paced environment",
                "interpretation": "Startup tolerance — candidate should thrive in ambiguous, rapid-change settings",
                "relevance": "high",
            })
        if "stakeholder" in jd_lower or "cross-functional" in jd_lower:
            implicit.append({
                "signal": "stakeholder management",
                "interpretation": "Needs senior communication and influencing skills beyond stated level",
                "relevance": "high",
            })
        if "self-starter" in jd_lower or "independent" in jd_lower or "autonomous" in jd_lower:
            implicit.append({
                "signal": "self-starter / independent worker",
                "interpretation": "Low supervision environment — candidate must be proactive",
                "relevance": "medium",
            })
        if "global" in jd_lower or "international" in jd_lower:
            implicit.append({
                "signal": "global/international context",
                "interpretation": "Cross-cultural collaboration and timezone flexibility needed",
                "relevance": "medium",
            })

        domains = []
        if "fintech" in jd_lower or "finance" in jd_lower:
            domains.append("fintech")
        if "healthcare" in jd_lower or "medical" in jd_lower:
            domains.append("healthcare")
        if "ecommerce" in jd_lower or "retail" in jd_lower:
            domains.append("ecommerce")
        if "saas" in jd_lower or "b2b" in jd_lower:
            domains.append("saas")

        return {
            "required_skills": ["Python", "FastAPI", "SQLAlchemy", "Docker"],
            "preferred_skills": ["Kubernetes", "AWS", "React"],
            "experience_required": {"years": 3, "level": "mid"},
            "education_required": "Bachelor's in Computer Science or equivalent",
            "key_responsibilities": [
                "Develop backend APIs using FastAPI",
                "Design and optimize database schemas",
                "Write unit and integration tests",
                "Collaborate with cross-functional teams",
            ],
            "soft_skills": ["Communication", "Teamwork", "Problem-solving"],
            "implicit_requirements": implicit,
            "role_level": "mid",
            "seniority_indicators": ["technical execution"],
            "domain_experience": domains if domains else ["general software engineering"],
        }

    async def evaluate_candidate(self, jd_text: str, candidate_data: dict) -> dict:
        """Evaluate a candidate against a job description."""
        if not settings.GROQ_API_KEY and not self.available:
            return self._mock_candidate_evaluation()

        prompt = f"""Evaluate this candidate against the job requirements.

Job Description:
{jd_text[:1500]}

Candidate Profile:
{json.dumps(candidate_data)[:1500]}

Return valid JSON with these fields:
{{
  "overall_score": 75.0,
  "skills_score": 80.0,
  "experience_score": 70.0,
  "education_score": 80.0,
  "cultural_fit_score": 75.0,
  "recommendation": "strong_yes|yes|maybe|no",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1"],
  "ai_evaluation": {{
    "summary": "Plain text summary paragraph evaluating candidate fit."
  }}
}}
"""
        res = await self._call_llm(prompt)
        if "error" in res:
            return self._mock_candidate_evaluation()
        return res

    def _mock_candidate_evaluation(self) -> dict:
        return {
            "overall_score": 78.5,
            "skills_score": 82.0,
            "experience_score": 75.0,
            "education_score": 80.0,
            "cultural_fit_score": 79.0,
            "recommendation": "yes",
            "strengths": ["Strong Python skills", "Good communication", "Team player"],
            "concerns": ["Limited cloud deployment experience"],
            "ai_evaluation": {"summary": "Good candidate with solid technical skills matching backend API requirements."}
        }

    async def generate_interview_questions(self, jd_text: str, candidate_data: dict, num_questions: int = 5) -> list:
        """Generate tailored interview questions based on candidate profile and job description."""
        if not settings.GROQ_API_KEY and not self.available:
            return self._mock_questions(num_questions)

        prompt = f"""Generate {num_questions} interview questions tailored specifically to this candidate and job description.
If the candidate lists Python or React, generate direct technical questions about them.
If the role is senior/managerial, focus heavily on leadership and behavioral scenarios.

Job Description:
{jd_text[:1000]}

Candidate Data:
{json.dumps(candidate_data)[:1000]}

Return valid JSON array of objects with these exact fields:
[
  {{
    "question_text": "Tailored question prompt...",
    "question_type": "technical|behavioral|situational|general",
    "think_time_seconds": 30,
    "time_limit_seconds": 180
  }}
]
"""
        res = await self._call_llm(prompt)
        if isinstance(res, list):
            return res
        if isinstance(res, dict) and "questions" in res:
            return res["questions"]
        return self._mock_questions(num_questions)

    def _mock_questions(self, num_questions: int) -> list:
        types = ["technical", "behavioral", "situational", "technical", "behavioral"]
        questions = [
            "Tell me about a challenging backend API or database optimization problem you resolved.",
            "How do you ensure code quality and write comprehensive unit tests in FastAPI?",
            "Describe a time you had to deliver a feature under tight deadlines with ambiguous requirements.",
            "Explain your experience with Docker containerization and deployment pipelines.",
            "How do you handle disagreement with team members about system design or architectural decisions?",
        ]
        return [
            {
                "question_text": q,
                "question_type": t,
                "think_time_seconds": 30,
                "time_limit_seconds": 180
            }
            for i, (q, t) in enumerate(zip(questions[:num_questions], types[:num_questions]))
        ]

    async def evaluate_transcript(self, transcript_json: str) -> dict:
        """Evaluate a transcribed interview response transcript."""
        if not settings.GROQ_API_KEY and not self.available:
            return self._mock_transcript_evaluation()

        prompt = f"""Evaluate this async interview session transcript.

Transcript:
{transcript_json}

Return valid JSON with these fields:
{{
  "overall_score": 80.0,
  "communication_score": 85.0,
  "technical_score": 78.0,
  "problem_solving_score": 80.0,
  "cultural_fit_score": 82.0,
  "recommendation": "strong_yes|yes|maybe|no",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "summary": "A 2 to 3 sentence summary of overall candidate answers."
}}
"""
        res = await self._call_llm(prompt)
        if "error" in res:
            return self._mock_transcript_evaluation()
        return res

    def _mock_transcript_evaluation(self) -> dict:
        return {
            "overall_score": 79.5,
            "communication_score": 82.0,
            "technical_score": 79.0,
            "problem_solving_score": 77.0,
            "cultural_fit_score": 80.0,
            "recommendation": "yes",
            "strengths": ["Clear communication style", "Demonstrates practical hands-on technical experience"],
            "weaknesses": ["Answer depth could be improved with more numerical/KPI details"],
            "summary": "The candidate completed the async video interview. Overall communication and technical alignment were evaluated."
        }

    async def generate_follow_up(self, previous_answers: list) -> list:
        """Generate follow-up questions based on previous answers."""
        if not settings.GROQ_API_KEY and not self.available:
            return [
                {"question": "Can you elaborate on your experience with system architecture decisions?"}
            ]

        prompt = f"""Based on these previous interview questions and answers, generate 3 follow-up questions the recruiter should ask in a live interview.

Answers:
{json.dumps(previous_answers)[:1500]}

Return valid JSON array of objects matching:
[
  {{
    "question": "Follow up question prompt..."
  }}
]
"""
        res = await self._call_llm(prompt)
        if isinstance(res, list):
            return res
        if isinstance(res, dict) and "questions" in res:
            return res["questions"]
        return [{"question": "Can you elaborate on your experience with system architecture decisions?"}]


ai_service = AIService()
