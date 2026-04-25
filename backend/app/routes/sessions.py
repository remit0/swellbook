import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, field_validator

from app.dependencies import get_current_user
from app.services import session_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response models ──────────────────────────────────────────────────

class SessionUpdateBody(BaseModel):
    """Request body for PATCH /sessions/{session_id}."""

    notes: str | None = None
    overall_rating: int | None = None
    spot_id: str | None = None
    date: str | None = None

    @field_validator("overall_rating")
    @classmethod
    def rating_in_range(cls, v: int | None) -> int | None:
        """Ensure rating is between 1 and 5."""
        if v is not None and not (1 <= v <= 5):
            raise ValueError("overall_rating must be between 1 and 5")
        return v

    @field_validator("date")
    @classmethod
    def date_is_iso(cls, v: str | None) -> str | None:
        """Ensure date is a parseable ISO 8601 string."""
        if v is not None:
            from datetime import datetime
            try:
                datetime.fromisoformat(v)
            except ValueError as exc:
                raise ValueError("date must be a valid ISO 8601 datetime string") from exc
        return v


class ApiResponse(BaseModel):
    """Standard { data, error } API response envelope."""

    data: dict | list | None
    error: str | None = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=ApiResponse)
async def create_session_route(
    audio: UploadFile,
    current_user: Annotated[dict, Depends(get_current_user)],
    lat: Annotated[float | None, Form()] = None,
    lng: Annotated[float | None, Form()] = None,
) -> ApiResponse:
    """Accept a multipart audio upload and log a new surf session.

    Args:
        audio: The recorded audio file (m4a or similar).
        current_user: Injected authenticated user dict.
        lat: Optional GPS latitude from the mobile client.
        lng: Optional GPS longitude from the mobile client.

    Returns:
        Standard API response: {data: {session, spot, forecast}, error: None}
    """
    try:
        audio_bytes = await audio.read()
    except IOError as exc:
        logger.error("Failed to read uploaded audio: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read audio file",
        ) from exc

    filename = audio.filename or "recording.m4a"

    result = await session_service.create_session(
        audio_bytes=audio_bytes,
        filename=filename,
        user_id=current_user["id"],
        user_lat=lat,
        user_lng=lng,
    )

    return ApiResponse(data=result)


@router.patch("/{session_id}", response_model=ApiResponse)
async def update_session_route(
    session_id: str,
    body: SessionUpdateBody,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ApiResponse:
    """Partially update an existing surf session.

    Args:
        session_id: UUID of the session to update.
        body: JSON body with optional fields to update.
        current_user: Injected authenticated user dict.

    Returns:
        Standard API response: {data: updated_session, error: None}
    """
    updates = body.model_dump(exclude_unset=True)

    updated_session = await session_service.update_session(
        session_id=session_id,
        user_id=current_user["id"],
        updates=updates,
    )

    return ApiResponse(data=updated_session)
