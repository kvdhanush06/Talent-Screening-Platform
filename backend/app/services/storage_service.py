"""Storage Service - Local and Supabase storage backends with transparent caching."""

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Service for file storage operations supporting local and Supabase storage."""

    def __init__(self):
        self.backend = settings.STORAGE_BACKEND  # "local" or "supabase"
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, *parts: str) -> Path:
        """Get a path within the upload directory."""
        path = self.upload_dir / Path(*parts)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def upload_file(self, file_bytes: bytes, filename: str, folder: str = "") -> str:
        """Upload a file and return its path or Supabase key."""
        ext = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = f"{folder}/{unique_name}" if folder else unique_name

        if self.backend == "local":
            dest_path = self._get_path(file_path)
            dest_path.write_bytes(file_bytes)
            return str(dest_path.relative_to(self.upload_dir))
        else:
            # Upload to Supabase Storage Bucket
            bucket = "talent-screening"
            url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}"
            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/octet-stream",
            }
            try:
                response = httpx.post(url, content=file_bytes, headers=headers, timeout=60.0)
                if response.status_code != 200:
                    logger.error(f"Supabase upload failed: {response.text}. Falling back to local storage...")
                    # Fallback to local storage
                    dest_path = self._get_path(file_path)
                    dest_path.write_bytes(file_bytes)
                    return f"local://{dest_path.relative_to(self.upload_dir)}"
                return file_path
            except Exception as e:
                logger.error(f"Supabase storage exception: {e}. Falling back to local...")
                dest_path = self._get_path(file_path)
                dest_path.write_bytes(file_bytes)
                return f"local://{dest_path.relative_to(self.upload_dir)}"

    async def upload_video(self, file_bytes: bytes, interview_id: str, question_id: str, filename: str) -> str:
        """Upload a video file."""
        folder = f"interviews/{interview_id}/videos"
        return self.upload_file(file_bytes, filename, folder)

    async def upload_resume(self, file_bytes: bytes, candidate_id: str, filename: str) -> str:
        """Upload a resume file."""
        folder = f"candidates/{candidate_id}/resumes"
        return self.upload_file(file_bytes, filename, folder)

    def get_file_path(self, relative_path: str) -> Path:
        """Get the absolute path for a stored file. If stored on Supabase, caches it locally first."""
        if relative_path.startswith("local://"):
            relative_path = relative_path[8:]

        local_path = self.upload_dir / relative_path
        if local_path.exists():
            return local_path

        # If it doesn't exist locally but is configured for Supabase, download it
        if self.backend == "supabase" or not local_path.exists():
            try:
                bucket = "talent-screening"
                url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{relative_path}"
                logger.info(f"Downloading remote file from Supabase: {url}")
                
                local_path.parent.mkdir(parents=True, exist_ok=True)
                response = httpx.get(url, timeout=60.0)
                if response.status_code == 200:
                    local_path.write_bytes(response.content)
                    logger.info(f"Successfully cached file locally at {local_path}")
                    return local_path
            except Exception as e:
                logger.error(f"Failed to cache Supabase file locally: {e}")

        return local_path

    def delete_file(self, relative_path: str) -> bool:
        """Delete a stored file from local storage (and Supabase if configured)."""
        if relative_path.startswith("local://"):
            relative_path = relative_path[8:]

        # Delete local copy
        try:
            path = self.upload_dir / relative_path
            if path.exists():
                path.unlink()
        except Exception as e:
            logger.error(f"Failed to delete local file: {e}")

        # Delete Supabase copy
        if self.backend == "supabase":
            try:
                bucket = "talent-screening"
                url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{relative_path}"
                headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}
                httpx.delete(url, headers=headers, timeout=10.0)
            except Exception as e:
                logger.error(f"Failed to delete file from Supabase: {e}")

        return True

    def get_download_url(self, relative_path: str) -> str:
        """Get a download URL for a file."""
        if relative_path.startswith("local://"):
            return f"/uploads/{relative_path[8:]}"

        if self.backend == "local":
            return f"/uploads/{relative_path}"
        else:
            bucket = "talent-screening"
            return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{relative_path}"


# Singleton instance
storage_service = StorageService()
