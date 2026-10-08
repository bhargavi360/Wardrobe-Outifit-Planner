"""Authenticated user preference routes."""

import logging
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
from app.core.db import get_database
from app.schemas.preferences import PreferencesPayload, PreferencesResponse

router = APIRouter(prefix="/preferences", tags=["preferences"])
logger = logging.getLogger(__name__)
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _to_preferences_response(
    user_id: str,
    document: dict[str, Any] | None = None,
) -> PreferencesResponse:
    values = document or {}
    return PreferencesResponse(
        user_id=user_id,
        favorite_colors=values.get("favorite_colors", []),
        preferred_styles=values.get("preferred_styles", []),
        disliked_colors=values.get("disliked_colors", []),
        gender_fit_notes=values.get("gender_fit_notes", ""),
    )


@router.get("", response_model=PreferencesResponse)
async def read_preferences(current_user: CurrentUser) -> PreferencesResponse:
    """Return saved preferences or defaults for the authenticated user."""
    user_id = str(current_user["_id"])
    try:
        document = await get_database()["preferences"].find_one({"_id": user_id})
    except PyMongoError as exc:
        logger.exception("Could not read user preferences")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Preferences are temporarily unavailable.",
        ) from exc
    return _to_preferences_response(user_id, document)


@router.put("", response_model=PreferencesResponse)
async def update_preferences(
    payload: PreferencesPayload,
    current_user: CurrentUser,
) -> PreferencesResponse:
    """Replace saved style preferences for the authenticated user."""
    user_id = str(current_user["_id"])
    values = payload.model_dump(mode="json")
    try:
        await get_database()["preferences"].update_one(
            {"_id": user_id},
            {
                "$set": {
                    **values,
                    "user_id": user_id,
                }
            },
            upsert=True,
        )
    except PyMongoError as exc:
        logger.exception("Could not update user preferences")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Preferences could not be saved right now.",
        ) from exc
    return _to_preferences_response(user_id, values)
