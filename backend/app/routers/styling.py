"""Gemini-based styling suggestions for selected outfit combinations."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
from app.core.db import get_database
from app.schemas.styling import StylingRequest, StylingTipResponse
from app.services.gemini_styling import get_cached_or_generate

router = APIRouter(prefix="/outfits", tags=["styling"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


@router.post("/styling-tips", response_model=StylingTipResponse)
async def create_styling_tips(
    payload: StylingRequest,
    current_user: CurrentUser,
) -> StylingTipResponse:
    """Generate a short styling suggestion for a selected outfit."""
    if payload.user_preferences is not None:
        preferences = payload.user_preferences.model_dump(mode="json")
    else:
        try:
            saved_preferences = await get_database()["preferences"].find_one(
                {"_id": str(current_user["_id"])}
            )
        except PyMongoError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Your style preferences are temporarily unavailable.",
            ) from exc
        preferences = {
            "favorite_colors": (saved_preferences or {}).get("favorite_colors", []),
            "disliked_colors": (saved_preferences or {}).get("disliked_colors", []),
            "preferred_styles": (saved_preferences or {}).get("preferred_styles", []),
        }

    result = await get_cached_or_generate(
        items=[item.model_dump(mode="json") for item in payload.items],
        occasion=payload.occasion.value,
        weather={
            "temperature_c": payload.weather.temperature_c,
            "condition": payload.weather.condition.value,
        },
        preferences=preferences,
    )
    return StylingTipResponse(**result)
