"""Account registration, sign-in, sign-out, and current-user routes."""

import logging
from datetime import UTC, datetime
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.db import get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.auth import Credentials, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _to_user_response(user: dict[str, Any]) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        created_at=user["created_at"],
    )


def _set_session_cookie(response: Response, user_id: str) -> None:
    try:
        token = create_access_token(
            subject=user_id,
            secret_key=settings.jwt_secret_key.get_secret_value(),
            expires_minutes=settings.jwt_access_token_expire_minutes,
        )
    except ValueError as exc:
        logger.error("Cannot issue an access token: JWT secret is not configured securely")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured. Set a secure JWT_SECRET_KEY.",
        ) from exc

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path=settings.api_prefix,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(credentials: Credentials, response: Response) -> UserResponse:
    """Create an account and establish its signed session cookie."""
    database = get_database()
    user = {
        "email": str(credentials.email),
        "password_hash": hash_password(credentials.password),
        "created_at": datetime.now(UTC),
    }
    try:
        result = await database["users"].insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    except PyMongoError as exc:
        logger.exception("Account registration failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The account service is temporarily unavailable.",
        ) from exc

    user["_id"] = result.inserted_id
    user_response = _to_user_response(user)
    _set_session_cookie(response, user_response.id)
    return user_response


@router.post("/login", response_model=UserResponse)
async def login(credentials: Credentials, response: Response) -> UserResponse:
    """Verify credentials and establish a signed session cookie."""
    try:
        user = await get_database()["users"].find_one(
            {"email": str(credentials.email)}
        )
    except PyMongoError as exc:
        logger.exception("Account lookup failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The account service is temporarily unavailable.",
        ) from exc

    if user is None or not verify_password(
        credentials.password,
        user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    user_response = _to_user_response(user)
    _set_session_cookie(response, user_response.id)
    return user_response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    """Clear the browser session cookie."""
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path=settings.api_prefix,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: CurrentUser) -> UserResponse:
    """Return the user associated with the valid session cookie."""
    return _to_user_response(current_user)
