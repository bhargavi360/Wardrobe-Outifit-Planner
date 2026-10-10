"""Account registration, sign-in, sign-out, and current-user routes."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo import ReturnDocument

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.db import get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.auth import Credentials, PasswordChange, ProfileUpdate, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _to_user_response(user: dict[str, Any]) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        created_at=user["created_at"],
        display_name=user.get("display_name", ""),
        city=user.get("city", ""),
        bio=user.get("bio", ""),
    )


def _set_session_cookie(response: Response, user_id: str, session_version: int = 0) -> None:
    try:
        token = create_access_token(
            subject=user_id,
            secret_key=settings.jwt_secret_key.get_secret_value(),
            expires_minutes=settings.jwt_access_token_expire_minutes,
            session_version=session_version,
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
    _set_session_cookie(response, user_response.id, user.get("session_version", 0))
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
    _set_session_cookie(response, user_response.id, user.get("session_version", 0))
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


@router.patch("/me", response_model=UserResponse)
async def update_profile(payload: ProfileUpdate, current_user: CurrentUser) -> UserResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(422, "Provide at least one profile field to update.")
    user = await get_database()["users"].find_one_and_update(
        {"_id": current_user["_id"]}, {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if user is None:
        raise HTTPException(404, "Account not found.")
    return _to_user_response(user)


@router.post("/password", status_code=204)
async def change_password(payload: PasswordChange, response: Response, current_user: CurrentUser) -> Response:
    old_hash = current_user.get("password_hash", "")
    if not await asyncio.to_thread(verify_password, payload.current_password, old_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(422, "Choose a new password different from your current password.")
    new_hash = await asyncio.to_thread(hash_password, payload.new_password)
    user = await get_database()["users"].find_one_and_update(
        {"_id": current_user["_id"], "password_hash": old_hash},
        {"$set": {"password_hash": new_hash}, "$inc": {"session_version": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if user is None:
        raise HTTPException(409, "Your password changed in another session. Sign in again.")
    _set_session_cookie(response, str(user["_id"]), user["session_version"])
    response.status_code = 204
    return response


@router.get("/export")
async def export_account(current_user: CurrentUser) -> dict[str, Any]:
    """Export account metadata; never include hashes, session tokens, or image files."""
    user_id = str(current_user["_id"])
    database = get_database()
    fields = {
        "clothing_items": ["name", "category", "sub_type", "dominant_colors", "season", "occasion_tags", "user_notes", "availability", "created_at"],
        "outfits": ["name", "occasion", "items", "notes", "is_favorite", "created_at", "updated_at"],
        "preferences": ["favorite_colors", "preferred_styles", "disliked_colors", "gender_fit_notes"],
        "outfit_calendar": ["date", "outfit_id", "name", "items", "status"],
        "trips": ["name", "destination", "start_date", "end_date", "outfit_ids", "outfit_names", "items", "packed_item_ids"],
    }
    result: dict[str, Any] = {"exported_at": datetime.now(UTC), "profile": _to_user_response(current_user).model_dump(mode="json")}
    for collection, allowed in fields.items():
        query = {"_id": user_id} if collection == "preferences" else {"user_id": user_id}
        documents = await database[collection].find(query).to_list(length=None)
        result[collection] = [{"id": str(document["_id"]), **{key: document[key] for key in allowed if key in document}} for document in documents]
    return result
