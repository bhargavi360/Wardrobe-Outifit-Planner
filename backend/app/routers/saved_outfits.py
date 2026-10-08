"""CRUD routes for saved outfits."""

from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
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


def _to_response(document: dict[str, Any]) -> SavedOutfitResponse:
    return SavedOutfitResponse(
        id=str(document["_id"]),
        user_id=document["user_id"],
        name=document["name"],
        occasion=document.get("occasion", "casual"),
        items=document.get("items", []),
        notes=document.get("notes", ""),
        is_favorite=bool(document.get("is_favorite", False)),
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
        document = await create_saved_outfit(str(current_user["_id"]), payload.model_dump(mode="json"))
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
