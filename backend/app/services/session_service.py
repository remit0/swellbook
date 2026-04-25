import asyncio
import logging
import math
from datetime import datetime, timezone
from functools import lru_cache

from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError
from supabase import create_client, Client

from app.config import settings
from app.services.whisper_service import transcribe_audio
from app.services.claude_service import extract_session_data
from app.services.stormglass_service import fetch_forecast

logger = logging.getLogger(__name__)

_PROXIMITY_THRESHOLD_KM = 1.0
_EARTH_RADIUS_KM = 6371.0


@lru_cache(maxsize=1)
def _get_supabase_client() -> Client:
    """Return a cached Supabase service-role client that bypasses RLS."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def _exec(query) -> object:
    """Run a synchronous Supabase query in a thread pool to avoid blocking the event loop."""
    return await asyncio.to_thread(query.execute)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance in km between two lat/lng points."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


async def _resolve_spot(
    supabase: Client,
    spot_name: str | None,
    user_lat: float | None,
    user_lng: float | None,
) -> dict | None:
    """Resolve the surf spot from an extracted name or user coordinates.

    Args:
        supabase: Supabase client instance.
        spot_name: Optional spot name extracted by Claude.
        user_lat: Optional latitude provided by the client.
        user_lng: Optional longitude provided by the client.

    Returns:
        A spot row dict, or None if no matching spot can be found.
    """
    if spot_name:
        try:
            result = await _exec(supabase.table("spots").select("*").ilike("name", spot_name))
        except PostgrestAPIError as exc:
            logger.error("Supabase spot name query failed: %s", exc)
            return None

        if result.data:
            logger.info("Spot resolved by name: %s", result.data[0]["name"])
            return result.data[0]

    if user_lat is not None and user_lng is not None:
        try:
            all_spots = await _exec(supabase.table("spots").select("*"))
        except PostgrestAPIError as exc:
            logger.error("Supabase spot list query failed: %s", exc)
            return None

        closest_spot: dict | None = None
        closest_dist = float("inf")

        for spot in all_spots.data:
            dist = _haversine_km(user_lat, user_lng, spot["lat"], spot["lng"])
            if dist < closest_dist:
                closest_dist = dist
                closest_spot = spot

        if closest_spot and closest_dist < _PROXIMITY_THRESHOLD_KM:
            logger.info("Spot resolved by proximity: %s (%.2f km)", closest_spot["name"], closest_dist)
            return closest_spot

    logger.info("No spot resolved for spot_name=%s lat=%s lng=%s", spot_name, user_lat, user_lng)
    return None


async def _upsert_forecast(
    supabase: Client,
    spot_id: str,
    session_date: datetime,
    forecast_data: dict,
) -> dict | None:
    """Upsert a forecast row for the given spot and time. Non-fatal on failure.

    Args:
        supabase: Supabase client instance.
        spot_id: UUID string of the spot.
        session_date: Session datetime (UTC).
        forecast_data: Snake-case forecast fields from Stormglass.

    Returns:
        The upserted forecast row dict, or None if the upsert failed.
    """
    forecast_payload = {
        "spot_id": spot_id,
        "timestamp": session_date.isoformat(),
        **forecast_data,
    }
    try:
        result = await _exec(
            supabase.table("forecasts").upsert(
                forecast_payload,
                on_conflict="spot_id,timestamp",
            )
        )
        return result.data[0] if result.data else None
    except PostgrestAPIError as exc:
        logger.warning("Forecast upsert failed (non-fatal): %s", exc)
        return None


async def create_session(
    audio_bytes: bytes,
    filename: str,
    user_id: str,
    user_lat: float | None,
    user_lng: float | None,
) -> dict:
    """Orchestrate the full session creation workflow.

    Steps:
        1. Transcribe audio via Whisper.
        2. Extract structured data from transcript via Claude.
        3. Resolve the surf spot by name or proximity.
        4. Parse the session date; default to now (UTC).
        5. Fetch retroactive forecast from Stormglass.
        6. Upsert forecast row into Supabase.
        7. Insert session row into Supabase.

    Args:
        audio_bytes: Raw audio file content.
        filename: Original audio filename.
        user_id: Authenticated user's UUID string.
        user_lat: Optional latitude from the mobile client.
        user_lng: Optional longitude from the mobile client.

    Returns:
        Dict with keys: session, spot, forecast.

    Raises:
        HTTPException 422: If the spot cannot be resolved.
        HTTPException 500: If a database write fails.
        IOError: Propagated from transcription or external API calls.
        ValueError: Propagated from JSON parsing or unexpected data shapes.
    """
    supabase = _get_supabase_client()

    transcript = await transcribe_audio(audio_bytes, filename)
    extracted = await extract_session_data(transcript)

    spot = await _resolve_spot(supabase, extracted.get("spot_name"), user_lat, user_lng)

    raw_date: str | None = extracted.get("date")
    if raw_date:
        try:
            session_date = datetime.fromisoformat(raw_date)
            if session_date.tzinfo is None:
                session_date = session_date.replace(tzinfo=timezone.utc)
        except ValueError:
            logger.warning("Could not parse extracted date '%s', defaulting to now", raw_date)
            session_date = datetime.now(timezone.utc)
    else:
        session_date = datetime.now(timezone.utc)

    forecast_row: dict | None = None
    if spot:
        forecast_data = await fetch_forecast(spot["lat"], spot["lng"], session_date)
        if forecast_data:
            forecast_row = await _upsert_forecast(supabase, spot["id"], session_date, forecast_data)

    session_payload = {
        "user_id": user_id,
        "spot_id": spot["id"] if spot else None,
        "date": session_date.isoformat(),
        "transcript_raw": transcript,
        "notes": extracted.get("notes"),
        "overall_rating": extracted.get("overall_rating"),
    }

    try:
        session_result = await _exec(supabase.table("sessions").insert(session_payload))
    except PostgrestAPIError as exc:
        logger.error("Session insert failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save session",
        ) from exc

    if not session_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save session",
        )

    session_row = session_result.data[0]
    logger.info("Session created: id=%s user=%s spot=%s", session_row.get("id"), user_id, spot["name"] if spot else None)

    return {
        "session": session_row,
        "spot": spot,
        "forecast": forecast_row,
    }


async def list_sessions(user_id: str) -> list[dict]:
    """Return all sessions for a user, ordered by date descending, with spot info.

    Args:
        user_id: Authenticated user's UUID string.

    Returns:
        List of session dicts, each with a nested 'spot' key (or None).
    """
    supabase = _get_supabase_client()

    try:
        result = await _exec(
            supabase.table("sessions")
            .select("*, spots(*)")
            .eq("user_id", user_id)
            .order("date", desc=True)
        )
    except PostgrestAPIError as exc:
        logger.error("Session list query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions",
        ) from exc

    sessions = []
    for row in result.data:
        spot = row.pop("spots", None)
        sessions.append({**row, "spot": spot})

    return sessions


async def update_session(session_id: str, user_id: str, updates: dict) -> dict:
    """Update allowed fields on an existing session.

    Args:
        session_id: UUID string of the session to update.
        user_id: Authenticated user's UUID string — must own the session.
        updates: Dict of fields to update (validated upstream by SessionUpdateBody).
                 Pass a field with value None to explicitly clear it.

    Returns:
        The updated session row dict.

    Raises:
        HTTPException 403: If the session does not belong to the user.
        HTTPException 404: If the session does not exist.
        HTTPException 500: If the update fails.
    """
    supabase = _get_supabase_client()

    try:
        existing = await _exec(supabase.table("sessions").select("id,user_id").eq("id", session_id))
    except PostgrestAPIError as exc:
        logger.error("Session ownership check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session",
        ) from exc

    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this session")

    if not updates:
        try:
            current = await _exec(supabase.table("sessions").select("*").eq("id", session_id))
        except PostgrestAPIError as exc:
            logger.error("Session fetch after empty update failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve session",
            ) from exc
        return current.data[0]

    try:
        result = await _exec(supabase.table("sessions").update(updates).eq("id", session_id))
    except PostgrestAPIError as exc:
        logger.error("Session update failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session",
        )

    updated_row = result.data[0]
    logger.info("Session updated: id=%s user=%s fields=%s", session_id, user_id, list(updates.keys()))
    return updated_row
