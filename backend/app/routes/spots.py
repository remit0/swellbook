import asyncio
import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic import BaseModel
from supabase import Client, create_client

from app.config import settings
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Supabase helpers ───────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_supabase_client() -> Client:
    """Return a cached Supabase service-role client that bypasses RLS."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def _exec(query) -> object:
    """Run a synchronous Supabase query in a thread pool to avoid blocking the event loop."""
    return await asyncio.to_thread(query.execute)


# ── Request / Response models ──────────────────────────────────────────────────

class SpotCreateBody(BaseModel):
    """Request body for POST /spots."""

    name: str
    lat: float | None = None
    lng: float | None = None


class ApiResponse(BaseModel):
    """Standard { data, error } API response envelope."""

    data: dict | list | None
    error: str | None = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=ApiResponse)
async def list_spots_route(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ApiResponse:
    """Return all surf spots ordered by name.

    Args:
        current_user: Injected authenticated user dict.

    Returns:
        Standard API response: {data: [{id, name, lat, lng}, ...], error: None}
    """
    supabase = _get_supabase_client()

    try:
        result = await _exec(supabase.table("spots").select("*").order("name"))
    except PostgrestAPIError as exc:
        logger.error("Spots list query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve spots",
        ) from exc

    return ApiResponse(data=result.data)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ApiResponse)
async def create_spot_route(
    body: SpotCreateBody,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ApiResponse:
    """Create a new surf spot.

    Args:
        body: JSON body with name (required), lat and lng (optional).
        current_user: Injected authenticated user dict.

    Returns:
        Standard API response: {data: {id, name, lat, lng}, error: None}
    """
    supabase = _get_supabase_client()

    payload: dict = {"name": body.name, "lat": body.lat, "lng": body.lng}

    try:
        result = await _exec(supabase.table("spots").insert(payload))
    except PostgrestAPIError as exc:
        logger.error("Spot insert failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create spot",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create spot",
        )

    spot_row = result.data[0]
    logger.info("Spot created: id=%s name=%s", spot_row.get("id"), spot_row.get("name"))
    return ApiResponse(data=spot_row)
