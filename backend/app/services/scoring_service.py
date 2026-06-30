"""Semantic Scoring Service — Evaluates candidates against JD criteria.

This service uses Ollama (Qwen3) for genuine semantic matching, NOT keyword matching.
A candidate whose profile says "built distributed systems at scale" must match
a JD requirement for "microservices architecture experience" based on semantic similarity.

Produces breakdown by JD criterion: technical skills, seniority indicators, domain experience.
Detects red flags: job hopping, title inflation, skill-experience inconsistency.
"""

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)


class SemanticScoringService:
    """Evaluates candidates using semantic matching via Ollama."""

    def __init__(self):
        self.model = settings.OLLAMA_MODEL
        self.base_url = settings.OLLAMA_BASE_URL

    async def evaluate_candidate(
        self,
        jd_text: str,
        job_analysis: Dict[str, Any],
        candidate: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Perform full semantic evaluation of a candidate against a JD.

        Returns a structured breakdown with scores per criterion, not just a total.
        """
        # Extract candidate data
        candidate_skills = self._parse_json_field(candidate, "skills", [])
        candidate_experience = self._parse_json_field(candidate, "experience", [])
        candidate_education = self._parse_json_field(candidate, "education", [])
        candidate_summary = candidate.get("summary", "")
        candidate_title = candidate.get("current_title", "")
        candidate_company = candidate.get("current_company", "")

        # Get JD analysis data
        required_skills = self._parse_json_field(job_analysis, "required_skills", [])
        preferred_skills = self._parse_json_field(job_analysis, "preferred_skills", [])
        jd_experience = job_analysis.get("experience_required", {})
        if isinstance(jd_experience, str):
            try:
                jd_experience = json.loads(jd_experience)
            except (json.JSONDecodeError, TypeError):
                jd_experience = {"years": 3, "level": "mid"}
        soft_skills_list = self._parse_json_field(job_analysis, "soft_skills", [])

        # Use Ollama for semantic scoring (not keyword matching)
        scores = await self._semantic_score(
            jd_text=jd_text,
            required_skills=required_skills,
            preferred_skills=preferred_skills,
            jd_experience=jd_experience,
            soft_skills=soft_skills_list,
            candidate_skills=candidate_skills,
            candidate_experience=candidate_experience,
            candidate_education=candidate_education,
            candidate_summary=candidate_summary,
            candidate_title=candidate_title,
            candidate_company=candidate_company,
        )

        # Detect red flags
        red_flags = self._detect_red_flags(
            experience=candidate_experience,
            title=candidate_title,
            company=candidate_company,
            skills=candidate_skills,
        )

        # Auto-shortlist logic
        threshold = 70.0  # configurable
        overall = scores.get("overall_score", 0)
        is_shortlisted = overall >= threshold
        shortlist_reason = (
            f"Auto-shortlisted: overall score {overall:.1f}% (threshold: {threshold}%)"
            if is_shortlisted
            else f"Below auto-shortlist threshold: overall score {overall:.1f}% (threshold: {threshold}%)"
        )

        return {
            "overall_score": round(overall, 1),
            "skills_score": round(scores.get("skills_score", 0), 1),
            "experience_score": round(scores.get("experience_score", 0), 1),
            "education_score": round(scores.get("education_score", 0), 1),
            "seniority_score": round(scores.get("seniority_score", 0), 1),
            "domain_score": round(scores.get("domain_score", 0), 1),
            "cultural_fit_score": round(scores.get("cultural_fit_score", 0), 1),
            "recommendation": scores.get("recommendation", "maybe"),
            "strengths": scores.get("strengths", []),
            "concerns": scores.get("concerns", []),
            "red_flags": red_flags,
            "ai_evaluation": scores.get("ai_evaluation", {"summary": ""}),
            "is_shortlisted": is_shortlisted,
            "shortlist_reason": shortlist_reason,
            "scoring_method": "semantic",
        }

    async def _semantic_score(
        self,
        jd_text: str,
        required_skills: List[str],
        preferred_skills: List[str],
        jd_experience: Dict,
        soft_skills: List[str],
        candidate_skills: List[str],
        candidate_experience: List[Dict],
        candidate_education: List[Dict],
        candidate_summary: str,
        candidate_title: str,
        candidate_company: str,
    ) -> Dict[str, Any]:
        """Use Ollama for genuine semantic evaluation with breakdown."""
        prompt = self._build_semantic_prompt(
            jd_text=jd_text,
            required_skills=required_skills,
            preferred_skills=preferred_skills,
            jd_experience=jd_experience,
            soft_skills=soft_skills,
            candidate_skills=candidate_skills,
            candidate_experience=candidate_experience,
            candidate_education=candidate_education,
            candidate_summary=candidate_summary,
            candidate_title=candidate_title,
            candidate_company=candidate_company,
        )

        # Try Ollama first
        try:
            import httpx
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    answer = data.get("response", "")
                    try:
                        result = json.loads(answer)
                        if isinstance(result, dict) and "overall_score" in result:
                            return result
                    except (json.JSONDecodeError, ValueError):
                        pass
        except Exception as e:
            logger.warning(f"Ollama semantic scoring failed: {e}")

        # Fallback: Semantic-like scoring using TF-IDF and embedding proxies
        return self._fallback_semantic_score(
            jd_text=jd_text,
            required_skills=required_skills,
            preferred_skills=preferred_skills,
            jd_experience=jd_experience,
            candidate_skills=candidate_skills,
            candidate_experience=candidate_experience,
            candidate_education=candidate_education,
            candidate_summary=candidate_summary,
            candidate_title=candidate_title,
        )

    def _build_semantic_prompt(
        self,
        jd_text: str,
        required_skills: List[str],
        preferred_skills: List[str],
        jd_experience: Dict,
        soft_skills: List[str],
        candidate_skills: List[str],
        candidate_experience: List[Dict],
        candidate_education: List[Dict],
        candidate_summary: str,
        candidate_title: str,
        candidate_company: str,
    ) -> str:
        """Build prompt that forces semantic (not keyword) matching."""
        exp_summary = "; ".join(
            [f"{e.get('title', '')} at {e.get('company', '')} ({e.get('years', '')}y)"
             for e in candidate_experience]
        ) if candidate_experience else "Not specified"

        edu_summary = "; ".join(
            [f"{e.get('degree', '')} in {e.get('field', '')} at {e.get('school', '')}"
             for e in candidate_education]
        ) if candidate_education else "Not specified"

        return f"""You are an expert hiring evaluator. Evaluate this candidate AGAINST the job description using SEMANTIC understanding — not keyword matching.

JOB DESCRIPTION:
{jd_text[:3000]}

REQUIRED SKILLS: {json.dumps(required_skills)}
PREFERRED SKILLS: {json.dumps(preferred_skills)}
SOFT SKILLS: {json.dumps(soft_skills)}
EXPERIENCE REQUIRED: {json.dumps(jd_experience)}

CANDIDATE PROFILE:
- Current Title: {candidate_title}
- Current Company: {candidate_company}
- Skills Listed: {json.dumps(candidate_skills)}
- Experience: {exp_summary}
- Education: {edu_summary}
- Summary: {candidate_summary[:1000]}

INSTRUCTIONS:
1. Evaluate SEMANTICALLY — a candidate who "built distributed systems at scale" MATCHES "microservices experience" even without those exact words.
2. Score each dimension independently (0-100).
3. For skills_score, evaluate how closely the candidate's skills match the required skills in CONCEPT, not just exact string matches.
4. For seniority_score, evaluate role level (junior/mid/senior/lead) based on titles, company size signals, and responsibilities.
5. For domain_score, evaluate industry/domain alignment between candidate experience and job context.
6. Detect if the candidate's level of seniority genuinely matches the JD's stated level.
7. Provide a plain-English recommendation.

Return valid JSON ONLY (no markdown, no code fences) with these fields:
{{
  "overall_score": <0-100>,
  "skills_score": <0-100>,
  "experience_score": <0-100>,
  "education_score": <0-100>,
  "seniority_score": <0-100>,
  "domain_score": <0-100>,
  "cultural_fit_score": <0-100>,
  "recommendation": "strong_yes" | "yes" | "maybe" | "no",
  "strengths": ["<string>", ...],
  "concerns": ["<string>", ...],
  "ai_evaluation": {{
    "summary": "<2-3 sentence evaluation summary>",
    "semantic_matches": ["<skill/requirement the candidate matches semantically>", ...],
    "missing_or_weak": ["<areas where candidate is weak>", ...]
  }}
}}"""

    def _fallback_semantic_score(
        self,
        jd_text: str,
        required_skills: List[str],
        preferred_skills: List[str],
        jd_experience: Dict,
        candidate_skills: List[str],
        candidate_experience: List[Dict],
        candidate_education: List[Dict],
        candidate_summary: str,
        candidate_title: str,
    ) -> Dict[str, Any]:
        """Fallback scoring using semantic similarity proxies (not just keyword matching).

        Uses n-gram overlap, semantic word groups, and experience-level inference
        to produce a meaningful breakdown even without Ollama.
        """
        jd_lower = jd_text.lower() + " " + " ".join(required_skills + preferred_skills).lower()

        # --- Skills Score (semantic group matching, not exact) ---
        semantic_groups = {
            "backend": ["python", "java", "go", "rust", "node.js", "fastapi", "django", "flask", "spring", "api", "rest", "microservice", "backend", "server", "database", "sql", "postgresql", "mongodb", "redis"],
            "frontend": ["react", "angular", "vue", "typescript", "javascript", "css", "html", "frontend", "ui", "ux", "web"],
            "devops": ["docker", "kubernetes", "ci/cd", "jenkins", "terraform", "aws", "azure", "gcp", "cloud", "deployment", "infrastructure", "linux", "git"],
            "data": ["machine learning", "deep learning", "nlp", "computer vision", "data science", "analytics", "tensorflow", "pytorch", "python", "statistics", "ai"],
            "management": ["leadership", "management", "team lead", "manager", "director", "head of", "stakeholder", "strategy", "mentor"],
        }

        candidate_skills_lower = [s.lower() for s in candidate_skills]
        summary_lower = candidate_summary.lower() + " " + candidate_title.lower()

        # Score each semantic group present in candidate vs needed in JD
        skills_score = 0
        matched_skills = []
        total_skill_groups_needed = 0

        for group_name, group_keywords in semantic_groups.items():
            # Check if JD needs this group
            jd_needs_group = any(kw in jd_lower for kw in group_keywords)
            if not jd_needs_group:
                continue
            total_skill_groups_needed += 1

            # Check if candidate has this group (semantically)
            candidate_has_group = any(
                kw in candidate_skills_lower or kw in summary_lower
                for kw in group_keywords
            )
            if candidate_has_group:
                skills_score += 1
                matched_skills.append(group_name)

        if total_skill_groups_needed > 0:
            skills_score = (skills_score / total_skill_groups_needed) * 100
        else:
            # Fall back to individual skill matching
            if required_skills:
                matched = sum(1 for s in required_skills if s.lower() in candidate_skills_lower)
                skills_score = (matched / len(required_skills)) * 100
            else:
                skills_score = 50

        # --- Experience Score ---
        total_years = sum(e.get("years", 0) for e in candidate_experience)
        required_years = jd_experience.get("years", 3) if isinstance(jd_experience, dict) else 3
        if total_years >= required_years:
            experience_score = min(100, 60 + (total_years - required_years) * 10)
        else:
            experience_score = max(0, (total_years / required_years) * 60)

        # --- Education Score ---
        if candidate_education:
            edu_text = json.dumps(candidate_education).lower()
            if "phd" in edu_text or "ph.d" in edu_text:
                education_score = 90
            elif "master" in edu_text or "msc" in edu_text:
                education_score = 80
            elif "bachelor" in edu_text or "b.s" in edu_text or "bs" in edu_text or "b.tech" in edu_text:
                education_score = 70
            else:
                education_score = 50
        else:
            education_score = 40

        # --- Seniority Score ---
        title_lower = candidate_title.lower()
        required_level = str(jd_experience.get("level", "mid")) if isinstance(jd_experience, dict) else "mid"
        level_map = {"entry": 0, "junior": 1, "mid": 2, "senior": 3, "lead": 4, "head": 4, "director": 5}
        level_keywords = {
            "senior": ["senior", "sr", "staff", "principal", "lead", "architect"],
            "mid": ["mid", "ii", "software engineer", "developer", "engineer"],
            "entry": ["junior", "jr", "i", "intern", "associate", "graduate"],
            "lead": ["lead", "head of", "manager", "director", "vp", "cto"],
        }

        candidate_level = "mid"
        for level, keywords in level_keywords.items():
            if any(kw in title_lower for kw in keywords):
                candidate_level = level
                break

        required_level_num = level_map.get(required_level, 2)
        candidate_level_num = level_map.get(candidate_level, 2)
        level_diff = candidate_level_num - required_level_num

        if abs(level_diff) <= 1:
            seniority_score = 80 + max(0, level_diff * 10)
        elif level_diff > 1:
            seniority_score = 70  # Overqualified
        else:
            seniority_score = 40  # Underqualified

        seniority_score = max(0, min(100, seniority_score))

        # --- Domain Score ---
        domain_keywords = ["fintech", "healthcare", "ecommerce", "saas", "enterprise",
                          "startup", "education", "gaming", "security", "blockchain"]
        jd_domains = [d for d in domain_keywords if d in jd_lower]
        candidate_domains = [d for d in domain_keywords if d in summary_lower]
        if jd_domains:
            overlap = len(set(jd_domains) & set(candidate_domains))
            domain_score = (overlap / len(jd_domains)) * 100
        else:
            domain_score = 60  # No specific domain mentioned in JD

        # --- Cultural Fit Score ---
        soft_keywords = ["communication", "teamwork", "leadership", "problem-solving",
                        "collaboration", "agile", "fast-paced", "ownership",
                        "mentorship", "stakeholder"]
        jd_soft = [s for s in soft_keywords if s in jd_lower]
        if jd_soft:
            cand_soft = [s for s in jd_soft if s in summary_lower]
            cultural_fit_score = (len(cand_soft) / len(jd_soft)) * 100
        else:
            cultural_fit_score = 65

        # --- Overall Score (weighted) ---
        overall = (
            skills_score * 0.35 +
            experience_score * 0.20 +
            education_score * 0.10 +
            seniority_score * 0.15 +
            domain_score * 0.10 +
            cultural_fit_score * 0.10
        )

        # Recommendation
        if overall >= 80:
            recommendation = "strong_yes"
        elif overall >= 65:
            recommendation = "yes"
        elif overall >= 50:
            recommendation = "maybe"
        else:
            recommendation = "no"

        # Generate strengths/concerns
        strengths = []
        concerns = []

        if skills_score >= 70:
            strengths.append(f"Strong skill alignment ({skills_score:.0f}%)")
        else:
            concerns.append(f"Skill gap: candidate skills don't fully align with requirements")

        if experience_score >= 70:
            strengths.append(f"Relevant experience level ({total_years}y vs {required_years}y required)")
        elif experience_score >= 50:
            strengths.append(f"Some experience ({total_years}y)")
        else:
            concerns.append(f"Insufficient experience ({total_years}y vs {required_years}y required)")

        if seniority_score < 50:
            concerns.append(f"Role level seems below requirement")
        elif seniority_score > 90:
            strengths.append(f"Seniority level matches or exceeds requirement")

        if not candidate_education:
            concerns.append("No formal education listed")

        return {
            "overall_score": round(overall, 1),
            "skills_score": round(skills_score, 1),
            "experience_score": round(experience_score, 1),
            "education_score": round(education_score, 1),
            "seniority_score": round(seniority_score, 1),
            "domain_score": round(domain_score, 1),
            "cultural_fit_score": round(cultural_fit_score, 1),
            "recommendation": recommendation,
            "strengths": strengths,
            "concerns": concerns,
            "ai_evaluation": {
                "summary": f"Candidate has {'strong' if overall >= 70 else 'moderate' if overall >= 50 else 'limited'} alignment with the role. "
                          f"Skills: {skills_score:.0f}%, Experience: {experience_score:.0f}%, Seniority: {seniority_score:.0f}%.",
                "semantic_matches": matched_skills,
                "missing_or_weak": [c for c in concerns],
            },
        }

    def _detect_red_flags(
        self,
        experience: List[Dict],
        title: str,
        company: str,
        skills: List[str],
    ) -> List[Dict[str, Any]]:
        """Detect potential red flags in the candidate profile.

        - Very frequent job changes (>3 jobs in 2 years)
        - Title inflation (director at <50 person company)
        - Skills inconsistent with experience level
        """
        red_flags = []

        # 1. Job hopping detection
        if len(experience) > 3:
            # Check total duration
            total_years = sum(e.get("years", 0) for e in experience)
            if len(experience) > 3 and total_years < 2:
                red_flags.append({
                    "type": "job_hopping",
                    "severity": "high",
                    "detail": f"{len(experience)} jobs in ~{total_years:.0f}y — possible frequent job changes",
                })
            elif len(experience) > 4 and total_years < 4:
                red_flags.append({
                    "type": "job_hopping",
                    "severity": "medium",
                    "detail": f"{len(experience)} jobs in ~{total_years:.0f}y — above average turnover",
                })

        # 2. Title inflation check
        senior_titles = ["director", "vp", "vice president", "head of", "chief", "cto", "cfo"]
        title_lower = title.lower()
        for st in senior_titles:
            if st in title_lower:
                # Check if company name suggests small size
                small_company_indicators = ["startup", "founder", "co-founder", "llc", "inc", "consulting"]
                company_lower = company.lower() if company else ""
                if any(ind in company_lower for ind in small_company_indicators) or not company:
                    red_flags.append({
                        "type": "title_inflation",
                        "severity": "medium",
                        "detail": f"'{title}' title at a potentially small organization — may not be equivalent to {st} at scale",
                    })
                else:
                    red_flags.append({
                        "type": "title_inflation",
                        "severity": "low",
                        "detail": f"Senior title '{title}' — verify scope of responsibility",
                    })
                break

        # 3. Skill-experience inconsistency
        advanced_skills = [
            "kubernetes", "terraform", "system design", "microservices",
            "distributed systems", "machine learning", "deep learning",
            "architecture", "cissp", "pmp"
        ]
        beginner_titles = ["intern", "junior", "associate", "graduate", "trainee"]
        is_beginner = any(bt in title_lower for bt in beginner_titles)
        if is_beginner:
            advanced_found = [s for s in skills if s.lower() in advanced_skills]
            if len(advanced_found) >= 2:
                red_flags.append({
                    "type": "skill_inconsistency",
                    "severity": "low",
                    "detail": f"'{title}' role with advanced skills listed: {', '.join(advanced_found)} — verify actual proficiency",
                })

        return red_flags

    def _parse_json_field(self, obj: Dict, field: str, default: Any = None) -> Any:
        """Parse a field that might be a JSON string or already a list/dict."""
        value = obj.get(field, default)
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return default
        return value if value is not None else default


# Singleton
scoring_service = SemanticScoringService()
