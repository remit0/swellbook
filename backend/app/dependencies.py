import asyncio
import logging
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import AuthApiError
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def _get_supabase_client() -> Client:
    """Return a cached Supabase client using the service role key."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """Validate the Bearer token against Supabase Auth and return the user dict.

    Raises HTTP 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials
    client = _get_supabase_client()

    try:
        response = await asyncio.to_thread(client.auth.get_user, token)
    except AuthApiError as exc:
        logger.warning("Token validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    if response is None or response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user = response.user
    return {"id": str(user.id), "email": user.email}
