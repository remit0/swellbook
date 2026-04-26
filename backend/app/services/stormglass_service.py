import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_STORMGLASS_URL = "https://api.stormglass.io/v2/weather/point"
_PARAMS = (
    "waveHeight,wavePeriod,waveDirection,"
    "windSpeed,windDirection,"
    "swellHeight,swellPeriod,swellDirection"
)

_FIELD_MAP = {
    "waveHeight": "wave_height",
    "wavePeriod": "wave_period",
    "waveDirection": "wave_direction",
    "windSpeed": "wind_speed",
    "windDirection": "wind_direction",
    "swellHeight": "swell_height",
    "swellPeriod": "swell_period",
    "swellDirection": "swell_direction",
}


def _pick_value(sources: dict) -> float | None:
    """Return the Stormglass (sg) value, or the first available source value."""
    if not isinstance(sources, dict):
        return None
    if "sg" in sources:
        return sources["sg"]
    for value in sources.values():
        if value is not None:
            return value
    return None


async def fetch_forecast(lat: float, lng: float, dt: datetime) -> dict:
    """Fetch Stormglass forecast data for a given location and time.

    Args:
        lat: Latitude of the surf spot.
        lng: Longitude of the surf spot.
        dt: The session datetime (timezone-aware UTC preferred).

    Returns:
        A dict with snake_case keys mapped from Stormglass fields.
        Returns an empty dict if the API call fails or returns no data.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    end_dt = dt + timedelta(hours=1)

    params = {
        "lat": lat,
        "lng": lng,
        "params": _PARAMS,
        "start": dt.isoformat(),
        "end": end_dt.isoformat(),
    }
    headers = {"Authorization": settings.STORMGLASS_API_KEY}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(_STORMGLASS_URL, params=params, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning("Stormglass API returned HTTP %s: %s", exc.response.status_code, exc)
        return {}
    except httpx.RequestError as exc:
        logger.warning("Stormglass request error: %s", exc)
        return {}

    try:
        payload = response.json()
        hours = payload.get("hours", [])
        if not hours:
            logger.warning("Stormglass returned no hours for lat=%s lng=%s dt=%s", lat, lng, dt)
            return {}
        first_hour = hours[0]
    except (ValueError, KeyError) as exc:
        logger.warning("Failed to parse Stormglass response: %s", exc)
        return {}

    result: dict = {}
    for sg_key, snake_key in _FIELD_MAP.items():
        result[snake_key] = _pick_value(first_hour.get(sg_key, {}))

    logger.info("Stormglass forecast fetched for lat=%s lng=%s", lat, lng)
    return result
