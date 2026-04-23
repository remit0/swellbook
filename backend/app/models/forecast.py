from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class Forecast(BaseModel):
    """Stormglass forecast data fetched retroactively for a spot."""

    id: UUID
    spot_id: UUID
    timestamp: datetime
    wave_height: float | None
    wave_period: float | None
    wave_direction: float | None
    wind_speed: float | None
    wind_direction: float | None
    swell_height: float | None
    swell_period: float | None
    swell_direction: float | None
    tide_height: float | None
    created_at: datetime
