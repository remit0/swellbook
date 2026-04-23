from pydantic import BaseModel
from uuid import UUID


class Spot(BaseModel):
    """A surf spot."""

    id: UUID
    name: str
    lat: float
    lng: float
