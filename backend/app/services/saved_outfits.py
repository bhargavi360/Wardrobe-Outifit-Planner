"""Service layer for saved outfit persistence and retrieval."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.db import get_database


async def list_saved_outfits_for_user(user_id: str) -> list[dict[str, Any]]:
    """Return all saved outfits for a specific user, newest first."""
    return await (
        get_database()["outfits"]
        .find({"user_id": user_id})
        .sort("created_at", -1)
        .to_list(length=1000)
    )


async def create_saved_outfit(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a saved outfit document."""
    now = datetime.now(UTC)
    document = {
        "_id": ObjectId(),
        "user_id": user_id,
        "name": payload.get("name", "Untitled outfit"),
        "occasion": payload.get("occasion", "casual"),
        "items": payload.get("items", []),
        "notes": payload.get("notes", ""),
        "is_favorite": bool(payload.get("is_favorite", False)),
        "created_at": now,
        "updated_at": now,
    }
    await get_database()["outfits"].insert_one(document)
    return document


async def update_saved_outfit(user_id: str, outfit_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    """Apply partial updates to an owned saved outfit."""
    object_id = ObjectId(outfit_id)
    result = await get_database()["outfits"].find_one_and_update(
        {"_id": object_id, "user_id": user_id},
        {"$set": {**updates, "updated_at": datetime.now(UTC)}},
        return_document=ReturnDocument.AFTER,
    )
    return result


async def delete_saved_outfit(user_id: str, outfit_id: str) -> bool:
    """Delete an outfit if it belongs to the provided user."""
    object_id = ObjectId(outfit_id)
    result = await get_database()["outfits"].find_one_and_delete({"_id": object_id, "user_id": user_id})
    return result is not None
