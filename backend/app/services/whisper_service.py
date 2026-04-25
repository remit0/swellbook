import logging
from functools import lru_cache

import openai
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_openai_client() -> AsyncOpenAI:
    """Return a cached AsyncOpenAI client."""
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Transcribe raw audio bytes using OpenAI Whisper.

    Args:
        audio_bytes: Raw audio file content.
        filename: Original filename, used to hint the file format.

    Returns:
        The transcribed text string.

    Raises:
        IOError: If the Whisper API call fails.
        ValueError: If the API returns an unexpected response shape.
    """
    client = _get_openai_client()

    try:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, "audio/m4a"),
        )
    except openai.OpenAIError as exc:
        logger.error("Whisper transcription failed: %s", exc)
        raise IOError("Transcription service unavailable") from exc

    transcript: str = response.text
    if not isinstance(transcript, str):
        raise ValueError(f"Unexpected Whisper response type: {type(transcript)}")

    logger.info("Transcription complete, length=%d chars", len(transcript))
    return transcript
