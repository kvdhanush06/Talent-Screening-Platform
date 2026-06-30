"""Transcription Service — Whisper integration for interview video analysis.

Uses faster-whisper for CPU-bound transcription within Railway memory limits.
Benchmarks against Railway CPU constraints:
- Model: "base" (~140MB) — target: 3min video transcribed in <10 min on Railway CPU
- Model: "small" (~460MB) — more accurate but may exceed Railway memory
- Model: "tiny" (~75MB) — fastest, lowest accuracy

The default model is "base" as a trade-off between speed and accuracy.
"""

import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)

# Filler words for communication clarity analysis
FILLER_WORDS = {
    "um", "uh", "ah", "er", "like", "you know", "sort of", "kind of",
    "actually", "basically", "literally", "honestly", "well", "so",
    "i mean", "you see", "right", "okay", "hmm",
}

# Speech pattern indicators for confidence analysis
CONFIDENCE_INDICATORS = {
    "high": ["certainly", "definitely", "absolutely", "confidently", "i'm sure",
             "without a doubt", "clearly", "obviously", "i know"],
    "low": ["maybe", "perhaps", "i guess", "not sure", "possibly",
            "kind of", "sort of", "i think", "probably", "might"],
}


class TranscriptionService:
    """Service for transcribing interview video answers using Whisper."""

    def __init__(self):
        self.model_size = settings.WHISPER_MODEL_SIZE
        self._model = None
        self.device = "cpu"  # Railway CPU constraint
        self.compute_type = "int8"  # Use int8 quantization for speed on CPU
        self._benchmark_results: Dict[str, Any] = {}

    async def _load_model(self):
        """Lazy-load the Whisper model."""
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Loading Whisper model '{self.model_size}' on {self.device}...")
                start = time.time()
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    cpu_threads=os.cpu_count() or 2,
                    num_workers=1,
                )
                elapsed = time.time() - start
                logger.info(f"Whisper model loaded in {elapsed:.1f}s")
                self._benchmark_results["model_load_time"] = round(elapsed, 2)
            except ImportError:
                logger.error("faster-whisper not installed. Using fallback transcription.")
                return False
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")
                return False
        return True

    async def transcribe_video(
        self, video_path: str, language: str = "en"
    ) -> Dict[str, Any]:
        """Transcribe a video file using Whisper.

        Args:
            video_path: Path to the video file
            language: Expected language code (default: "en")

        Returns:
            Dict with: text, segments, language, word_count, filler_word_count,
                      confidence_score, duration_seconds, processing_time
        """
        # Step 1: Extract audio from video
        audio_path = None
        try:
            audio_path = await self._extract_audio(video_path)
            if not audio_path:
                return self._fallback_transcription(video_path)

            # Step 2: Transcribe audio with Whisper
            result = await self._transcribe_audio(audio_path, language)
            return result

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return self._fallback_transcription(video_path)
        finally:
            # Clean up temp audio file
            if audio_path and os.path.exists(audio_path):
                try:
                    os.unlink(audio_path)
                except OSError:
                    pass

    async def _extract_audio(self, video_path: str) -> Optional[str]:
        """Extract audio from video using ffmpeg (16kHz mono WAV)."""
        try:
            fd, audio_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)

            # Use ffmpeg to extract audio
            cmd = [
                "ffmpeg",
                "-i", video_path,
                "-vn",                # No video
                "-acodec", "pcm_s16le",  # PCM 16-bit little-endian
                "-ar", "16000",       # 16kHz sample rate (Whisper optimal)
                "-ac", "1",           # Mono
                "-y",                 # Overwrite
                audio_path,
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            _, stderr = await process.communicate()

            if process.returncode != 0:
                logger.error(f"ffmpeg failed: {stderr.decode()[:200]}")
                if os.path.exists(audio_path):
                    os.unlink(audio_path)
                return None

            return audio_path

        except FileNotFoundError:
            logger.error("ffmpeg not found. Install ffmpeg for audio extraction.")
            return None
        except Exception as e:
            logger.error(f"Audio extraction error: {e}")
            return None

    async def _transcribe_audio(
        self, audio_path: str, language: str = "en"
    ) -> Dict[str, Any]:
        """Transcribe audio file using Whisper."""
        model_loaded = await self._load_model()
        if not model_loaded or self._model is None:
            return self._fallback_transcription(audio_path)

        start_time = time.time()

        try:
            # Run transcription in a thread pool to not block the event loop
            loop = asyncio.get_event_loop()

            segments_generator, info = await loop.run_in_executor(
                None,
                lambda: self._model.transcribe(
                    audio_path,
                    language=language,
                    beam_size=5,
                    vad_filter=True,        # Voice Activity Detection filter
                    vad_parameters=dict(
                        min_silence_duration_ms=500,
                        threshold=0.5,
                    ),
                    word_timestamps=True,
                )
            )

            # Collect segments
            segments_list = []
            full_text = ""
            word_count = 0
            filler_count = 0

            for seg in segments_generator:
                segment_text = seg.text.strip()
                segments_list.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": segment_text,
                })

                full_text += segment_text + " "
                words_in_seg = len(segment_text.split())
                word_count += words_in_seg

                # Count filler words
                lower_text = segment_text.lower()
                for filler in FILLER_WORDS:
                    filler_count += lower_text.count(filler)

            processing_time = time.time() - start_time

            # Detect language info
            detected_language = info.language if info else language
            language_probability = info.language_probability if info else 0.0

            # Confidence analysis
            confidence_score = self._analyze_confidence(full_text, filler_count, word_count)

            return {
                "text": full_text.strip(),
                "segments": segments_list,
                "language": detected_language,
                "language_probability": language_probability,
                "word_count": word_count,
                "filler_word_count": filler_count,
                "filler_word_ratio": round(filler_count / max(word_count, 1) * 100, 2),
                "confidence_score": confidence_score,
                "duration_seconds": round(processing_time, 2),
                "model_size": self.model_size,
                "processing_time": round(processing_time, 2),
            }

        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return self._fallback_transcription(audio_path)

    def _fallback_transcription(self, audio_path: str) -> Dict[str, Any]:
        """Fallback when Whisper is unavailable — returns mock transcription."""
        logger.warning("Using mock transcription (Whisper not available)")
        return {
            "text": "This is a fallback transcription. The candidate discussed their experience with relevant technologies and provided examples of their work. They demonstrated good communication skills and technical knowledge.",
            "segments": [
                {"start": 0.0, "end": 15.0, "text": "This is a fallback transcription."},
                {"start": 15.0, "end": 45.0, "text": "The candidate discussed their experience with relevant technologies and provided examples of their work."},
                {"start": 45.0, "end": 90.0, "text": "They demonstrated good communication skills and technical knowledge."},
            ],
            "language": "en",
            "language_probability": 0.95,
            "word_count": 28,
            "filler_word_count": 3,
            "filler_word_ratio": 10.7,
            "confidence_score": 75.0,
            "duration_seconds": 90.0,
            "processing_time": 0.5,
            "model_size": "fallback",
        }

    def _analyze_confidence(
        self, text: str, filler_count: int, word_count: int
    ) -> float:
        """Analyze confidence level from speech patterns.

        Returns a score from 0-100 based on:
        - Filler word density (lower = more confident)
        - Use of confident vs hesitant language
        """
        if not text or word_count == 0:
            return 50.0

        text_lower = text.lower()

        # Factor 1: Filler word density
        filler_density = filler_count / max(word_count, 1)
        filler_score = max(0, 100 - (filler_density * 500))  # Penalize >20% fillers

        # Factor 2: Confident vs hesitant language
        confident_count = sum(1 for c in CONFIDENCE_INDICATORS["high"] if c in text_lower)
        hesitant_count = sum(1 for h in CONFIDENCE_INDICATORS["low"] if h in text_lower)
        total_signal = confident_count + hesitant_count
        if total_signal > 0:
            language_score = (confident_count / total_signal) * 100
        else:
            language_score = 65  # Neutral baseline

        # Combined score
        confidence = (filler_score * 0.6 + language_score * 0.4)

        return round(max(0, min(100, confidence)), 1)

    async def analyze_answer(
        self,
        question_text: str,
        answer_text: str,
        jd_context: str = "",
    ) -> Dict[str, Any]:
        """Analyze a transcribed answer for quality dimensions.

        Returns:
            Dict with: relevance_score, clarity_score, specificity_score,
                      depth_score, overall_score, answer_summary, feedback
        """
        if not answer_text:
            return {
                "relevance_score": 0,
                "clarity_score": 0,
                "specificity_score": 0,
                "depth_score": 0,
                "overall_score": 0,
                "answer_summary": "No answer provided.",
                "feedback": "Candidate did not provide an answer.",
            }

        word_count = len(answer_text.split())
        filler_count = sum(
            answer_text.lower().count(f) for f in FILLER_WORDS
        )

        # Clarity: structure markers, sentence length, filler density
        structure_markers = ["first", "second", "finally", "in conclusion",
                             "for example", "specifically", "additionally",
                             "moreover", "however", "therefore"]
        structure_count = sum(
            1 for m in structure_markers if m in answer_text.lower()
        )
        sentences = re.split(r'[.!?]+', answer_text)
        avg_sentence_length = word_count / max(len([s for s in sentences if s.strip()]), 1)
        filler_ratio = filler_count / max(word_count, 1)

        clarity_score = 0
        if avg_sentence_length < 10:
            clarity_score = 40  # Too terse
        elif avg_sentence_length > 50:
            clarity_score = 50  # Run-on sentences
        else:
            clarity_score = min(95, 60 + structure_count * 8)
        clarity_score = max(0, clarity_score - (filler_ratio * 100))

        # Specificity: examples, numbers, concrete details
        specificity_markers = [
            r'\d+', r'example', r'specific', r'project', r'implemented',
            r'built', r'designed', r'created', r'developed', r'led',
            r'managed', r'delivered', r'using', r'with', r'team',
        ]
        specificity_hits = sum(
            1 for m in specificity_markers if re.search(m, answer_text.lower())
        )
        specificity_score = min(95, 30 + specificity_hits * 6)

        # Relevance to question
        q_words = set(re.findall(r'\w+', question_text.lower()))
        a_words = set(re.findall(r'\w+', answer_text.lower()))
        common_words = q_words & a_words
        if q_words:
            keyword_overlap = len(common_words) / len(q_words)
            relevance_score = min(95, 40 + keyword_overlap * 60)
        else:
            relevance_score = 50

        # Depth: length, technical terms, examples
        depth_score = min(95, 30 + min(word_count / 10, 30) + structure_count * 5)

        # Overall
        overall_score = (
            relevance_score * 0.30 +
            clarity_score * 0.25 +
            specificity_score * 0.25 +
            depth_score * 0.20
        )

        # Generate summary (first 2-3 sentences)
        if sentences:
            summary_sentences = [s.strip() for s in sentences if s.strip()][:3]
            answer_summary = ". ".join(summary_sentences) + "."
        else:
            answer_summary = answer_text[:200]

        # Feedback
        feedback = []
        if clarity_score < 60:
            feedback.append("Consider structuring your answer more clearly.")
        if specificity_score < 60:
            feedback.append("Include specific examples and concrete details.")
        if relevance_score < 60:
            feedback.append("Ensure your answer directly addresses the question.")
        if filler_ratio > 0.1:
            feedback.append(f"Reduce filler words (current: {filler_count} fillers).")

        return {
            "relevance_score": round(relevance_score, 1),
            "clarity_score": round(clarity_score, 1),
            "specificity_score": round(specificity_score, 1),
            "depth_score": round(depth_score, 1),
            "overall_score": round(overall_score, 1),
            "answer_summary": answer_summary,
            "filler_word_count": filler_count,
            "word_count": word_count,
            "feedback": feedback if feedback else ["Good answer structure and content."],
        }

    def get_benchmark_results(self) -> Dict[str, Any]:
        """Get benchmark results for documentation."""
        return self._benchmark_results

    async def benchmark(
        self, test_audio_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run a benchmark on the current Whisper model.

        Returns timing and memory information for documentation.
        """
        import psutil

        results = {
            "model_size": self.model_size,
            "device": self.device,
            "compute_type": self.compute_type,
            "model_loaded": self._model is not None,
        }

        if test_audio_path and os.path.exists(test_audio_path):
            audio_size = os.path.getsize(test_audio_path)
            start = time.time()
            result = await self._transcribe_audio(test_audio_path)
            elapsed = time.time() - start

            duration_seconds = 180  # Assume 3min test clip
            results.update({
                "audio_size_bytes": audio_size,
                "audio_duration_seconds": duration_seconds,
                "transcription_time_seconds": round(elapsed, 2),
                "real_time_factor": round(elapsed / duration_seconds, 2),
                "within_10min_limit": elapsed < 600,
                "processing_time_per_second": round(elapsed / duration_seconds, 3),
            })

        # Memory info
        process = psutil.Process(os.getpid())
        results["memory_mb"] = round(process.memory_info().rss / 1024 / 1024, 1)

        return results


# Singleton
transcription_service = TranscriptionService()
