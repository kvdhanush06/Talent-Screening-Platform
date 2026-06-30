"""Scraper Service — Candidate sourcing from LinkedIn and other public sources.

Handles pagination, rate limiting with exponential backoff, and partial data.
A candidate profile with only name and title is processed at lower confidence.
"""

import asyncio
import json
import logging
import random
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.data_store import CANDIDATES

logger = logging.getLogger(__name__)

# --- Configuration ---

MAX_RETRIES = 3
BASE_DELAY_SECONDS = 2.0
BACKOFF_MULTIPLIER = 2.0
REQUEST_TIMEOUT = 30.0

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]


# --- Rate Limiter ---

class RateLimiter:
    """Token-bucket rate limiter with exponential backoff."""

    def __init__(self, requests_per_minute: int = 20):
        self.min_interval = 60.0 / requests_per_minute
        self.last_request_time: float = 0.0
        self.retry_count: int = 0

    async def wait(self):
        """Wait appropriate time before next request."""
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.min_interval:
            await asyncio.sleep(self.min_interval - elapsed)

    async def on_success(self):
        """Called after successful request."""
        self.last_request_time = time.time()
        self.retry_count = 0

    async def on_rate_limited(self):
        """Called on 429 response — exponential backoff."""
        self.retry_count += 1
        delay = BASE_DELAY_SECONDS * (BACKOFF_MULTIPLIER ** (self.retry_count - 1))
        delay = min(delay, 60.0)  # Cap at 60 seconds
        jitter = random.uniform(0, 0.5)
        logger.info(f"Rate limited. Backing off {delay + jitter:.1f}s (attempt {self.retry_count})")
        await asyncio.sleep(delay + jitter)
        self.last_request_time = time.time()


# --- Scraping Sources ---

class LinkedInScraper:
    """Scrapes LinkedIn public search results (respects rate limits)."""

    def __init__(self):
        self.limiter = RateLimiter(requests_per_minute=15)

    async def search(
        self, job_title: str, location: str = "", max_pages: int = 3
    ) -> List[Dict[str, Any]]:
        """Search LinkedIn for candidates matching job title and location."""
        all_results: List[Dict[str, Any]] = []
        seen_profiles: set = set()

        # Use Google search as a proxy for LinkedIn public profiles
        search_queries = [
            f'site:linkedin.com/in "{job_title}" "{location}"',
            f'site:linkedin.com/in "{job_title}"',
            f'intitle:"{job_title}" site:linkedin.com/in',
        ]

        for page in range(1, max_pages + 1):
            for query in search_queries:
                results = await self._search_google(query, page)
                for profile in results:
                    profile_id = profile.get("profile_url", profile.get("name", ""))
                    if profile_id not in seen_profiles:
                        seen_profiles.add(profile_id)
                        all_results.append(profile)

                # Rate limit between queries
                await asyncio.sleep(random.uniform(1, 3))

            # Between pages
            await asyncio.sleep(random.uniform(2, 4))

        # Deduplicate
        unique = []
        seen_names = set()
        for p in all_results:
            name = p.get("name", "").lower().strip()
            if name and name not in seen_names:
                seen_names.add(name)
                unique.append(p)
            elif not name:
                unique.append(p)

        logger.info(f"LinkedIn search returned {len(unique)} candidate profiles")
        return unique

    async def _search_google(
        self, query: str, page: int = 1
    ) -> List[Dict[str, Any]]:
        """Search via Google Custom Search API (primary) or direct HTTP search (fallback)."""
        # 1. Try official Google Custom Search API if credentials are provided
        if settings.GOOGLE_SEARCH_API_KEY and settings.GOOGLE_CSE_ID:
            try:
                params = {
                    "key": settings.GOOGLE_SEARCH_API_KEY,
                    "cx": settings.GOOGLE_CSE_ID,
                    "q": query,
                    "start": (page - 1) * 10 + 1
                }
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    resp = await client.get(
                        "https://www.googleapis.com/customsearch/v1",
                        params=params
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    
                    results = []
                    for item in data.get("items", []):
                        title = item.get("title", "")
                        snippet = item.get("snippet", "")
                        link = item.get("link", "")
                        
                        # Extract skills and clean up titles
                        skills = self._extract_skills(snippet)
                        name_match = re.search(r'([A-Z][a-z]+ [A-Z][a-z]+)', title)
                        
                        # Split title to extract job role title if possible
                        title_parts = title.split("-")
                        extracted_title = title_parts[1].strip() if len(title_parts) > 1 else title_parts[0].strip()
                        if "linkedin" in extracted_title.lower():
                            extracted_title = extracted_title.replace("LinkedIn", "").replace("linkedin", "").strip()

                        profile = {
                            "name": name_match.group(1) if name_match else title.split("-")[0].strip(),
                            "current_title": extracted_title,
                            "current_company": "",
                            "profile_url": link,
                            "skills": skills,
                            "summary": snippet,
                            "source": "google_api",
                        }
                        profile["confidence_level"] = self._calculate_confidence(profile)
                        results.append(profile)
                    return results
            except Exception as e:
                logger.error(f"Google Custom Search API error: {e}. Falling back to direct scraping...")

        # 2. Fall back to direct search page scraping
        await self.limiter.wait()

        ua = random.choice(USER_AGENTS)
        params = {"q": query, "start": (page - 1) * 10}

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                headers = {
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                }
                resp = await client.get(
                    "https://www.google.com/search", params=params, headers=headers
                )

                if resp.status_code == 429:
                    await self.limiter.on_rate_limited()
                    return []
                if resp.status_code != 200:
                    logger.warning(f"Google search returned {resp.status_code}")
                    return []

                await self.limiter.on_success()
                return self._parse_linkedin_results(resp.text)

        except httpx.TimeoutException:
            logger.warning(f"Google search timed out for: {query}")
            return []
        except Exception as e:
            logger.error(f"Google search error: {e}")
            return []

    def _parse_linkedin_results(self, html: str) -> List[Dict[str, Any]]:
        """Extract LinkedIn profile info from search result snippets."""
        results = []
        # Find all search result snippets
        snippets = re.findall(
            r'<div[^>]*class="[^"]*BNeawe[^"]*"[^>]*>(.*?)</div>',
            html, re.DOTALL
        )

        for snippet in snippets[:10]:  # Max 10 per page
            text = re.sub(r'<[^>]+>', ' ', snippet).strip()
            if not text or len(text) < 10:
                continue

            # Extract name (usually first few words of a LinkedIn result)
            name_match = re.search(
                r'([A-Z][a-z]+ [A-Z][a-z]+)\s*[-|].*?linkedin',
                text[:200], re.IGNORECASE
            )

            # Extract title
            title_match = re.search(
                r'(?:as\s+a\s+|–\s*)([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Designer|Analyst|Scientist|Director|Lead|Architect|Consultant))',
                text[:300]
            )

            # Extract company
            company_match = re.search(
                r'(?:at|@|–\s*)([A-Z][a-zA-Z\s]{2,30})(?:\s*[–|]|\s*$)',
                text[:300]
            )

            # Extract profile URL
            url_match = re.search(
                r'https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)',
                text
            )

            # Extract skills mentioned in snippet
            skills = self._extract_skills(text)

            profile = {
                "name": name_match.group(1) if name_match else "",
                "current_title": title_match.group(1).strip() if title_match else "",
                "current_company": company_match.group(1).strip() if company_match else "",
                "profile_url": url_match.group(0) if url_match else "",
                "skills": skills,
                "summary": text[:300] if text else "",
                "source": "linkedin",
            }

            # Confidence level based on data completeness
            confidence = self._calculate_confidence(profile)
            profile["confidence_level"] = confidence

            results.append(profile)

        return results

    def _extract_skills(self, text: str) -> List[str]:
        """Extract skill-like terms from text."""
        skill_keywords = [
            "Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "Rust",
            "React", "Angular", "Vue", "Node.js", "Django", "FastAPI", "Flask",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Terraform",
            "SQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch",
            "Machine Learning", "AI", "Deep Learning", "NLP", "Computer Vision",
            "Agile", "Scrum", "Leadership", "Product Management",
            "CI/CD", "Git", "Linux", "REST API", "GraphQL",
            "Microservices", "System Design", "Distributed Systems",
        ]
        found = []
        for skill in skill_keywords:
            if skill.lower() in text.lower():
                found.append(skill)
        return found[:8]  # Max 8 skills

    def _calculate_confidence(self, profile: Dict) -> str:
        """Calculate confidence level based on data completeness."""
        score = 0
        if profile.get("name"): score += 2
        if profile.get("current_title"): score += 2
        if profile.get("current_company"): score += 2
        if profile.get("profile_url"): score += 1
        if profile.get("skills"): score += 2
        if profile.get("summary") and len(profile["summary"]) > 50: score += 1

        if score >= 8: return "high"
        if score >= 4: return "medium"
        return "low"


class JobBoardScraper:
    """Scrapes public job board candidate profiles (secondary source).

    Uses Indeed / Google for Jobs as secondary source.
    """

    def __init__(self):
        self.limiter = RateLimiter(requests_per_minute=20)

    async def search(
        self, job_title: str, location: str = "", max_pages: int = 2
    ) -> List[Dict[str, Any]]:
        """Search for candidate profiles on public sources."""
        results = []

        # Simulate real scraping with rate limiting
        for page in range(1, max_pages + 1):
            await self.limiter.wait()

            try:
                ua = random.choice(USER_AGENTS)
                query = f'"{job_title}" resume OR portfolio site:github.io OR site:stackoverflow.com OR site:medium.com'
                params = {"q": query, "start": (page - 1) * 10}

                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    resp = await client.get(
                        "https://www.google.com/search",
                        params=params,
                        headers={
                            "User-Agent": ua,
                            "Accept": "text/html",
                            "Accept-Language": "en-US,en;q=0.5",
                        },
                    )

                    if resp.status_code == 429:
                        await self.limiter.on_rate_limited()
                        continue

                    await self.limiter.on_success()
                    page_results = self._parse_results(resp.text, page)
                    results.extend(page_results)

            except Exception as e:
                logger.error(f"Job board search error (page {page}): {e}")
                continue

            await asyncio.sleep(random.uniform(1, 3))

        logger.info(f"Job board search returned {len(results)} candidates")
        return results

    def _parse_results(self, html: str, page: int) -> List[Dict[str, Any]]:
        """Parse search results into candidate profiles."""
        results = []
        snippets = re.findall(
            r'<div[^>]*class="[^"]*BNeawe[^"]*"[^>]*>(.*?)</div>',
            html, re.DOTALL
        )

        for i, snippet in enumerate(snippets[:8]):
            text = re.sub(r'<[^>]+>', ' ', snippet).strip()
            if not text or len(text) < 20:
                continue

            name_match = re.search(r'([A-Z][a-z]+ [A-Z][a-z]+)', text[:150])
            title_match = re.search(
                r'([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Designer|Analyst|Scientist|Freelancer|Consultant))',
                text[:300]
            )

            skills = []
            for skill in ["Python", "React", "JavaScript", "TypeScript", "Java",
                          "Docker", "AWS", "Node.js", "Go", "Rust", "Kubernetes"]:
                if skill.lower() in text.lower():
                    skills.append(skill)

            profile = {
                "name": name_match.group(1) if name_match else f"Developer {page * 10 + i + 1}",
                "current_title": title_match.group(1).strip() if title_match else job_title,
                "current_company": "",
                "profile_url": "",
                "skills": skills[:6],
                "summary": text[:300],
                "source": "job_board",
            }
            profile["confidence_level"] = self._calculate_confidence(profile)
            results.append(profile)

        return results

    def _calculate_confidence(self, profile: Dict) -> str:
        """Calculate confidence for job board profiles."""
        score = 0
        if profile.get("name") and profile["name"] != "": score += 2
        if profile.get("current_title"): score += 1
        if profile.get("skills"): score += 2
        if profile.get("summary") and len(profile["summary"]) > 50: score += 1

        if score >= 4: return "high"
        if score >= 2: return "medium"
        return "low"


# --- Main Scraper Pipeline ---

class ScraperService:
    """Orchestrates scraping across multiple sources with deduplication."""

    def __init__(self):
        self.linkedin = LinkedInScraper()
        self.job_board = JobBoardScraper()

    async def scrape_candidates(
        self,
        job_title: str,
        location: str = "",
        job_id: str = "",
    ) -> List[Dict[str, Any]]:
        """Scrape candidates from all sources and merge results."""
        logger.info(f"Starting scrape for '{job_title}' in '{location}'")

        # Run both scrapers in parallel
        linkedin_task = self.linkedin.search(job_title, location)
        jobboard_task = self.job_board.search(job_title, location)

        linkedin_results, jobboard_results = await asyncio.gather(
            linkedin_task, jobboard_task, return_exceptions=True
        )

        if isinstance(linkedin_results, Exception):
            logger.error(f"LinkedIn scraper failed: {linkedin_results}")
            linkedin_results = []
        if isinstance(jobboard_results, Exception):
            logger.error(f"Job board scraper failed: {jobboard_results}")
            jobboard_results = []

        # Merge and deduplicate
        all_candidates = self._merge_candidates(
            linkedin_results, jobboard_results, job_id
        )

        logger.info(
            f"Scrape complete: {len(linkedin_results)} LinkedIn + "
            f"{len(jobboard_results)} job board → {len(all_candidates)} unique candidates"
        )
        return all_candidates

    def _merge_candidates(
        self,
        linkedin: List[Dict],
        jobboard: List[Dict],
        job_id: str,
    ) -> List[Dict[str, Any]]:
        """Merge results from both sources, deduplicating by name."""
        seen = set()
        merged = []

        for source_list, source_name in [
            (linkedin, "linkedin"),
            (jobboard, "job_board"),
        ]:
            for profile in source_list:
                name = profile.get("name", "").lower().strip()
                dedup_key = name if name else profile.get("profile_url", str(uuid.uuid4()))

                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                candidate = self._profile_to_candidate(profile, job_id)
                if candidate:
                    merged.append(candidate)

        return merged

    def _profile_to_candidate(
        self, profile: Dict, job_id: str
    ) -> Optional[Dict]:
        """Convert a scraped profile to the standard candidate format."""
        if not profile.get("name") and not profile.get("current_title"):
            return None  # Too sparse

        candidate_id = str(uuid.uuid4())
        candidate = {
            "id": candidate_id,
            "job_id": job_id,
            "source": profile.get("source", "scraped"),
            "source_id": profile.get("profile_url", ""),
            "name": profile.get("name", "Unknown Candidate"),
            "email": f"{candidate_id[:8]}@scraped.talent",
            "phone": "",
            "current_title": profile.get("current_title", ""),
            "current_company": profile.get("current_company", ""),
            "location": "",
            "summary": profile.get("summary", ""),
            "skills": json.dumps(profile.get("skills", [])),
            "experience": json.dumps([]),
            "education": json.dumps([]),
            "resume_url": profile.get("profile_url", ""),
            "profile_url": profile.get("profile_url", ""),
            "match_score": None,
            "is_shortlisted": False,
            "shortlist_reason": None,
            "status": "new",
            "confidence_level": profile.get("confidence_level", "low"),
            "red_flags": json.dumps([]),
            "created_at": str(datetime.utcnow()),
            "updated_at": str(datetime.utcnow()),
        }
        return candidate


# Singleton
scraper_service = ScraperService()
