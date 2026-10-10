"""Outfit recommendation routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
from app.core.db import get_database
from app.schemas.outfit_recommendation import (
    OutfitRecommendationResponse,
    OutfitRecommendationRequest,
)
from app.services.outfit_recommender import recommend_outfits

router = APIRouter(prefix="/outfits", tags=["outfits"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


@router.post("/recommend", response_model=OutfitRecommendationResponse)
async def recommend_wardrobe_outfits(
    payload: OutfitRecommendationRequest,
    current_user: CurrentUser,
) -> OutfitRecommendationResponse:
    """Return the highest-scoring outfit combinations for the active wardrobe."""
    database = get_database()
    try:
        wardrobe_documents = await (
            database["clothing_items"]
            .find({"user_id": str(current_user["_id"])})
            .to_list(length=None)
        )
        preferences = (
            payload.user_preferences.model_dump(mode="json")
            if payload.user_preferences is not None
            else None
        )
        if preferences is None:
            saved_preferences = await database["preferences"].find_one(
                {"_id": str(current_user["_id"])}
            )
            preferences = {
                "favorite_colors": (saved_preferences or {}).get("favorite_colors", []),
                "disliked_colors": (saved_preferences or {}).get("disliked_colors", []),
                "preferred_styles": (saved_preferences or {}).get("preferred_styles", []),
                "gender_fit_notes": (saved_preferences or {}).get("gender_fit_notes", ""),
            }
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your wardrobe or style preferences are temporarily unavailable for outfit planning.",
        ) from exc

    if not wardrobe_documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Add at least one clothing item to generate outfit ideas.",
        )

    if payload.required_item_id is not None and not any(
        str(document["_id"]) == payload.required_item_id for document in wardrobe_documents
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That piece is no longer in your wardrobe. Choose another piece.",
        )

    if payload.required_item_id is not None and any(
        str(document["_id"]) == payload.required_item_id and document.get("availability") == "laundry"
        for document in wardrobe_documents
    ):
        raise HTTPException(409, "Your chosen piece is in the laundry. Mark it available in Wardrobe or choose another piece.")

    recommendations = recommend_outfits(
        wardrobe_items=[dict(document) for document in wardrobe_documents],
        occasion=payload.occasion,
        temperature_c=payload.weather.temperature_c,
        condition=payload.weather.condition,
        preferences=preferences,
        required_item_id=payload.required_item_id,
    )
    return OutfitRecommendationResponse(recommendations=recommendations)
