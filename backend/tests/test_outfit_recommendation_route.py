"""API-level tests for the authenticated outfit recommendation route."""

import asyncio
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import outfits
from app.schemas.outfit_recommendation import OutfitRecommendationRequest


class _Cursor:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents

    async def to_list(self, length: int | None) -> list[dict[str, Any]]:
        return self.documents[:length]


class _Collection:
    def __init__(
        self,
        documents: list[dict[str, Any]] | None = None,
        preference: dict[str, Any] | None = None,
    ) -> None:
        self.documents = documents or []
        self.preference = preference
        self.find_query: dict[str, Any] | None = None
        self.preference_query: dict[str, Any] | None = None

    def find(self, query: dict[str, Any]) -> _Cursor:
        self.find_query = query
        return _Cursor(self.documents)

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        self.preference_query = query
        return self.preference


class _Database:
    def __init__(self, collections: dict[str, _Collection]) -> None:
        self.collections = collections

    def __getitem__(self, name: str) -> _Collection:
        return self.collections[name]


def test_recommendation_route_uses_saved_preferences_and_user_wardrobe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clothing_items = _Collection(
        documents=[
            {"_id": "red-top", "name": "Red top", "category": "top", "dominant_colors": ["red"]},
            {"_id": "blue-top", "name": "Blue top", "category": "top", "dominant_colors": ["blue"]},
            {"_id": "bottom", "name": "Black trousers", "category": "bottom", "dominant_colors": ["black"]},
        ]
    )
    saved_preferences = _Collection(
        preference={
            "favorite_colors": ["red"],
            "disliked_colors": [],
            "preferred_styles": ["casual"],
        }
    )
    database = _Database(
        {"clothing_items": clothing_items, "preferences": saved_preferences}
    )
    monkeypatch.setattr(outfits, "get_database", lambda: database)
    request = OutfitRecommendationRequest.model_validate(
        {
            "occasion": "casual",
            "weather": {"temperature_c": 22, "condition": "sunny"},
        }
    )

    response = asyncio.run(
        outfits.recommend_wardrobe_outfits(request, {"_id": "user-42"})
    )

    assert clothing_items.find_query == {"user_id": "user-42"}
    assert saved_preferences.preference_query == {"_id": "user-42"}
    assert response.recommendations[0].items[0].id == "red-top"
    assert any(
        "favorite color: red" in reason.label
        for reason in response.recommendations[0].reasons
    )


def test_required_piece_is_validated_against_owned_wardrobe(monkeypatch: pytest.MonkeyPatch) -> None:
    clothing_items = _Collection(documents=[
        {"_id": "owned", "name": "Dress", "category": "dress"},
    ])
    database = _Database({"clothing_items": clothing_items, "preferences": _Collection()})
    monkeypatch.setattr(outfits, "get_database", lambda: database)
    payload = {"occasion": "casual", "weather": {"temperature_c": 22}, "required_item_id": "owned"}
    response = asyncio.run(outfits.recommend_wardrobe_outfits(
        OutfitRecommendationRequest.model_validate(payload), {"_id": "user-42"},
    ))
    assert response.recommendations[0].items[0].id == "owned"
    assert clothing_items.find_query == {"user_id": "user-42"}
    payload["required_item_id"] = "someone-elses-piece"
    with pytest.raises(HTTPException) as failure:
        asyncio.run(outfits.recommend_wardrobe_outfits(
            OutfitRecommendationRequest.model_validate(payload), {"_id": "user-42"},
        ))
    assert failure.value.status_code == 404
