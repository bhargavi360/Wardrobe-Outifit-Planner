"""Tests for authenticated outfit styling-tip request handling."""

import asyncio
from typing import Any

from app.routers import styling
from app.schemas.styling import StylingRequest


class _PreferencesCollection:
    async def find_one(self, query: dict[str, Any]) -> dict[str, Any]:
        assert query == {"_id": "user-1"}
        return {
            "favorite_colors": ["navy"],
            "disliked_colors": ["orange"],
            "preferred_styles": ["formal"],
        }


class _Database:
    def __getitem__(self, name: str) -> _PreferencesCollection:
        assert name == "preferences"
        return _PreferencesCollection()


def test_styling_route_uses_saved_preferences(monkeypatch: Any) -> None:
    request = StylingRequest.model_validate(
        {
            "occasion": "formal",
            "weather": {"temperature_c": 18, "condition": "cloudy"},
            "items": [
                {
                    "id": "top-1",
                    "name": "Navy shirt",
                    "category": "top",
                    "dominant_colors": ["navy"],
                }
            ],
        }
    )
    received: dict[str, Any] = {}

    async def fake_generate(**kwargs: Any) -> dict[str, Any]:
        received.update(kwargs)
        return {
            "styling_tip": "Keep the look tailored.",
            "accessory_suggestions": ["Watch", "Belt"],
            "why_it_works": "The palette is composed.",
            "source": "fallback",
        }

    monkeypatch.setattr(styling, "get_database", lambda: _Database())
    monkeypatch.setattr(styling, "get_cached_or_generate", fake_generate)

    response = asyncio.run(
        styling.create_styling_tips(request, {"_id": "user-1"})
    )

    assert received["occasion"] == "formal"
    assert received["weather"] == {"temperature_c": 18.0, "condition": "cloudy"}
    assert received["preferences"]["favorite_colors"] == ["navy"]
    assert response.source == "fallback"
    assert response.styling_tip == "Keep the look tailored."
