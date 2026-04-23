from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class Session(BaseModel):
    """A surf session logged by the user."""

    id: UUID
    user_id: UUID
    spot_id: UUID
    date: datetime
    transcript_raw: str | None
    notes: str | None
    overall_rating: int | None  # 1-5
    created_at: datetime
