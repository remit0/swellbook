import json
import logging
from functools import lru_cache

import anthropic
from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)


def _extract_json_object(text: str) -> str | None:
    """Extract the first complete JSON object from text using bracket counting."""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


_EXTRACTION_PROMPT = """\
You are a surf session data extractor. The user speaks in French or English.

Given the following voice transcript of a surf session, extract the structured data below and return ONLY a valid JSON object — no prose, no markdown fences.

Fields to extract:
- spot_name: string or null — the explicit name of the surf spot if mentioned, otherwise null
- date: string or null — ISO 8601 datetime if a date/time is mentioned, otherwise null (if the user says "today" or "this morning" without a specific date, return null)
- duration_minutes: integer or null — session duration in minutes if mentioned, otherwise null
- notes: string — a brief description (1-3 sentences) of how the session felt, in the same language as the transcript
- overall_rating: integer or null — a rating from 1 to 5 if mentioned or clearly implied, otherwise null

Transcript:
{transcript}
"""


@lru_cache(maxsize=1)
def _get_anthropic_client() -> AsyncAnthropic:
    """Return a cached AsyncAnthropic client."""
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def extract_session_data(transcript: str) -> dict:
    """Extract structured session data from a voice transcript using Claude.

    Args:
        transcript: Raw text produced by Whisper transcription.

    Returns:
        A dict with keys: spot_name, date, duration_minutes, notes, overall_rating.

    Raises:
        IOError: If the Anthropic API call fails.
        ValueError: If Claude's response cannot be parsed as valid JSON.
    """
    client = _get_anthropic_client()
    prompt = _EXTRACTION_PROMPT.format(transcript=transcript)

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.AnthropicError as exc:
        logger.error("Claude API error during extraction: %s", exc)
        raise IOError("Extraction service unavailable") from exc

    raw_text: str = message.content[0].text.strip()

    json_str = _extract_json_object(raw_text)
    if json_str is None:
        raise ValueError(f"No JSON object found in Claude response: {raw_text!r}")

    try:
        extracted: dict = json.loads(json_str)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned invalid JSON: {exc}") from exc

    logger.info("Session data extracted: spot=%s rating=%s", extracted.get("spot_name"), extracted.get("overall_rating"))
    return extracted
