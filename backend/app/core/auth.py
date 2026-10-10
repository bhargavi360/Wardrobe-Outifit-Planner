"""Dependencies for resolving an authenticated user from the session cookie."""

from typing import Any

import jwt
from bson import ObjectId
from fastapi import HTTPException, Request, status
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.db import get_database
from app.core.security import decode_access_token


async def get_current_user(request: Request) -> dict[str, Any]:
    """Validate the session cookie and return its active MongoDB user."""
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    try:
        payload = decode_access_token(
            token,
            settings.jwt_secret_key.get_secret_value(),
        )
        subject = payload.get("sub")
        if not isinstance(subject, str) or not ObjectId.is_valid(subject):
            raise ValueError("Invalid token subject.")
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired. Please sign in again.",
        ) from exc

    try:
        user = await get_database()["users"].find_one({"_id": ObjectId(subject)})
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The account service is temporarily unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account no longer exists. Please sign in again.",
        )
    if payload.get("version", 0) != user.get("session_version", 0):
        raise HTTPException(401, "Your password has changed. Please sign in again.")
    return user
