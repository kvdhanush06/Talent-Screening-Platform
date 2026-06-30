"""Talent Screening Platform - Application Configuration."""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/talent_screening"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-me-to-a-random-secret-key-32-characters-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # AI / Groq / Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Google Search API (Scraper Sourcing)
    GOOGLE_SEARCH_API_KEY: str = ""
    GOOGLE_CSE_ID: str = ""

    # External APIs
    TINYFISH_API_KEY: str = ""
    TINYFISH_BASE_URL: str = "https://api.tinyfish.com/v1"

    # Storage
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    STORAGE_BACKEND: str = "local"
    UPLOAD_DIR: str = "./uploads"

    # Email (Gmail SMTP)
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@talentscreening.com"

    # Transcription
    WHISPER_MODEL_SIZE: str = "base"

    # App
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:19006"

    class Config:
        env_prefix = "TALENT_"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
