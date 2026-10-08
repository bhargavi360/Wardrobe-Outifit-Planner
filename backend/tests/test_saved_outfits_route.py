"""Tests for the authenticated saved-outfit CRUD routes."""

import asyncio
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.routers import saved_outfits
from app.schemas.saved_outfit import SavedOutfitCreate, SavedOutfitUpdate


def _document(outfit_id: ObjectId | None = None) -> dict[str, Any]:
    return {
        "_id": outfit_id or ObjectId(),
        "user_id": "user-1",
        "name": "Weekend look",
        "occasion": "casual",
        "items": [
            {
                "item_id": "top-1",
                "category": "top",
                "name": "Linen shirt",
                "dominant_colors": ["navy"],
                "sub_type": "shirt",
            }
        ],
        "notes": "",
        "is_favorite": False,
        "created_at": datetime.now(UTC),
    }


def test_create_saved_outfit_uses_authenticated_user(
    monkeypatch: Any,
) -> None:
    document = _document()
    received: dict[str, Any] = {}

    async def fake_create(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        received["user_id"] = user_id
        received["payload"] = payload
        return document

    monkeypatch.setattr(saved_outfits, "create_saved_outfit", fake_create)
    payload = SavedOutfitCreate.model_validate(
        {
            "name": "Weekend look",
            "occasion": "casual",
            "items": document["items"],
        }
    )

    response = asyncio.run(saved_outfits.create_outfit(payload, {"_id": "user-1"}))

    assert received["user_id"] == "user-1"
    assert received["payload"]["name"] == "Weekend look"
    assert response.id == str(document["_id"])
    assert response.items[0].item_id == "top-1"


def test_list_saved_outfits_returns_only_user_service_results(
    monkeypatch: Any,
) -> None:
    document = _document()
    received: list[str] = []

    async def fake_list(user_id: str) -> list[dict[str, Any]]:
        received.append(user_id)
        return [document]

    monkeypatch.setattr(saved_outfits, "list_saved_outfits_for_user", fake_list)
    response = asyncio.run(saved_outfits.list_saved_outfits({"_id": "user-1"}))

    assert received == ["user-1"]
    assert len(response) == 1
    assert response[0].name == "Weekend look"


def test_update_saved_outfit_passes_partial_rename_and_favorite(
    monkeypatch: Any,
) -> None:
    outfit_id = ObjectId()
    document = _document(outfit_id)
    document["name"] = "Dinner look"
    document["is_favorite"] = True
    received: dict[str, Any] = {}

    async def fake_update(
        user_id: str,
        requested_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        received.update(user_id=user_id, outfit_id=requested_id, updates=updates)
        return document

    monkeypatch.setattr(saved_outfits, "update_saved_outfit", fake_update)
    payload = SavedOutfitUpdate.model_validate(
        {"name": "Dinner look", "is_favorite": True}
    )

    response = asyncio.run(
        saved_outfits.update_outfit(str(outfit_id), payload, {"_id": "user-1"})
    )

    assert received == {
        "user_id": "user-1",
        "outfit_id": str(outfit_id),
        "updates": {"name": "Dinner look", "is_favorite": True},
    }
    assert response.name == "Dinner look"
    assert response.is_favorite is True


def test_delete_saved_outfit_passes_authenticated_owner(
    monkeypatch: Any,
) -> None:
    outfit_id = str(ObjectId())
    received: dict[str, str] = {}

    async def fake_delete(user_id: str, requested_id: str) -> bool:
        received.update(user_id=user_id, outfit_id=requested_id)
        return True

    monkeypatch.setattr(saved_outfits, "delete_saved_outfit", fake_delete)

    asyncio.run(saved_outfits.delete_outfit(outfit_id, {"_id": "user-1"}))

    assert received == {"user_id": "user-1", "outfit_id": outfit_id}
