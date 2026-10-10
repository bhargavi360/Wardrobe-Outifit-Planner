"""CRUD routes for saved outfits."""

from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
from app.core.db import get_database
from app.schemas.saved_outfit import (
    SavedOutfitCreate,
    SavedOutfitResponse,
    SavedOutfitUpdate,
)
from app.services.saved_outfits import (
    create_saved_outfit,
    delete_saved_outfit,
    list_saved_outfits_for_user,
    update_saved_outfit,
)

router = APIRouter(prefix="/outfits", tags=["saved_outfits"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


async def owned_items(user_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Use current wardrobe metadata and reject missing, foreign, or repeated pieces."""
    ids = [item["item_id"] for item in items]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Each wardrobe piece can appear only once in an outfit.")
    if any(not ObjectId.is_valid(value) for value in ids):
        raise HTTPException(409, "A piece is no longer in your wardrobe. Remove or replace it before saving.")
    documents = await get_database()["clothing_items"].find(
        {"user_id": user_id, "_id": {"$in": [ObjectId(value) for value in ids]}}
    ).to_list(length=None)
    by_id = {str(document["_id"]): document for document in documents}
    if any(value not in by_id for value in ids):
        raise HTTPException(409, "A piece is no longer in your wardrobe. Remove or replace it before saving.")
    return [{"item_id": value, "name": by_id[value]["name"], "category": by_id[value]["category"],
             "dominant_colors": by_id[value].get("dominant_colors", []), "sub_type": by_id[value].get("sub_type")} for value in ids]


def _to_response(document: dict[str, Any]) -> SavedOutfitResponse:
    return SavedOutfitResponse(
        id=str(document["_id"]),
        user_id=document["user_id"],
        name=document["name"],
        occasion=document.get("occasion", "casual"),
        items=document.get("items", []),
        notes=document.get("notes", ""),
        is_favorite=bool(document.get("is_favorite", False)),
        created_at=document.get("created_at"),
        updated_at=document.get("updated_at"),
    )


@router.get("", response_model=list[SavedOutfitResponse])
async def list_saved_outfits(current_user: CurrentUser) -> list[SavedOutfitResponse]:
    """List saved outfits owned by the authenticated user."""
    try:
        documents = await list_saved_outfits_for_user(str(current_user["_id"]))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Saved outfits are temporarily unavailable.",
        ) from exc
    return [_to_response(document) for document in documents]


@router.post("", response_model=SavedOutfitResponse, status_code=status.HTTP_201_CREATED)
async def create_outfit(
    payload: SavedOutfitCreate,
    current_user: CurrentUser,
) -> SavedOutfitResponse:
    """Create a saved outfit for the current user."""
    try:
        data = payload.model_dump(mode="json")
        data["items"] = await owned_items(str(current_user["_id"]), data["items"])
        document = await create_saved_outfit(str(current_user["_id"]), data)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your saved outfit could not be created.",
        ) from exc
    return _to_response(document)


@router.patch("/{outfit_id}", response_model=SavedOutfitResponse)
async def update_outfit(
    outfit_id: str,
    payload: SavedOutfitUpdate,
    current_user: CurrentUser,
) -> SavedOutfitResponse:
    """Update a saved outfit owned by the current user."""
    if not ObjectId.is_valid(outfit_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved outfit not found.",
        )

    updates = payload.model_dump(mode="json", exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update.",
        )

    try:
        if "items" in updates:
            updates["items"] = await owned_items(str(current_user["_id"]), updates["items"])
        document = await update_saved_outfit(str(current_user["_id"]), outfit_id, updates)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your saved outfit could not be updated.",
        ) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved outfit not found.",
        )
    return _to_response(document)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit(
    outfit_id: str,
    current_user: CurrentUser,
) -> None:
    """Delete a saved outfit owned by the current user."""
    if not ObjectId.is_valid(outfit_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved outfit not found.",
        )

    try:
        deleted = await delete_saved_outfit(str(current_user["_id"]), outfit_id)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your saved outfit could not be deleted.",
        ) from exc

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved outfit not found.",
        )
