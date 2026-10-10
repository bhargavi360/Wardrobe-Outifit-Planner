"""Authenticated wardrobe collection and image endpoints."""

import asyncio
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

import cv2
from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import ValidationError
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.db import get_database
from app.schemas.wardrobe import (
    ClothingCategory,
    Season,
    WardrobeItemCreate,
    WardrobeItemResponse,
    WardrobeItemUpdate,
)
from app.services.attribute_detection import analyze_image_file
from app.services.storage import (
    ImageStorage,
    ImageStorageAdapter,
    ImageTooLargeError,
    InvalidImageError,
    StoredImage,
    UploadStorageError,
)

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])
logger = logging.getLogger(__name__)
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
image_storage: ImageStorageAdapter = ImageStorage(settings.uploads_dir)


def _to_item_response(document: dict[str, Any]) -> WardrobeItemResponse:
    item_id = str(document["_id"])
    return WardrobeItemResponse(
        id=item_id,
        name=document["name"],
        image_url=document.get(
            "image_url",
            f"{settings.api_prefix}/wardrobe/{item_id}/image",
        ),
        category=document["category"],
        sub_type=document.get("sub_type"),
        dominant_colors=document.get("dominant_colors", []),
        season=document.get("season", Season.ALL_SEASON.value),
        occasion_tags=document.get("occasion_tags", []),
        user_notes=document.get("user_notes", ""),
        created_at=document["created_at"],
        dominant_color_hex=document.get("dominant_color_hex", []),
        pattern=document.get("pattern"),
        sleeve_length=document.get("sleeve_length"),
        attribute_summary=document.get("attribute_summary"),
        availability=document.get("availability", "available"),
    )


def _parse_item_id(item_id: str) -> ObjectId:
    if not ObjectId.is_valid(item_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wardrobe item not found.",
        )
    return ObjectId(item_id)


async def _save_upload(upload: UploadFile) -> StoredImage:
    try:
        return await image_storage.save(upload)
    except InvalidImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ImageTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except UploadStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is unavailable.",
        ) from exc


async def _extract_attributes(filename: str, category: str) -> dict[str, Any]:
    image_path = Path(settings.uploads_dir) / filename
    return await asyncio.to_thread(analyze_image_file, image_path, category)


@router.get("", response_model=list[WardrobeItemResponse])
async def list_wardrobe(
    current_user: CurrentUser,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> list[WardrobeItemResponse]:
    """List only the signed-in user's wardrobe items."""
    try:
        documents = await (
            get_database()["clothing_items"]
            .find({"user_id": str(current_user["_id"])})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )
    except PyMongoError as exc:
        logger.exception("Could not list wardrobe items")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your wardrobe is temporarily unavailable.",
        ) from exc
    return [_to_item_response(document) for document in documents]


@router.post(
    "",
    response_model=WardrobeItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_wardrobe_item(
    current_user: CurrentUser,
    image: Annotated[UploadFile, File()],
    name: Annotated[str, Form()],
    category: Annotated[ClothingCategory, Form()],
    sub_type: Annotated[str | None, Form()] = None,
    dominant_colors: Annotated[list[str] | None, Form()] = None,
    season: Annotated[Season, Form()] = Season.ALL_SEASON,
    occasion_tags: Annotated[list[str] | None, Form()] = None,
    user_notes: Annotated[str, Form()] = "",
) -> WardrobeItemResponse:
    """Save an image and its metadata as an item owned by the current user."""
    try:
        payload = WardrobeItemCreate(
            name=name,
            category=category,
            sub_type=sub_type,
            dominant_colors=dominant_colors or [],
            season=season,
            occasion_tags=occasion_tags or [],
            user_notes=user_notes,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(include_context=False, include_url=False),
        ) from exc

    stored_image = await _save_upload(image)
    detected_attributes: dict[str, Any] = {}
    try:
        detected_attributes = await _extract_attributes(
            stored_image.filename,
            payload.category.value,
        )
    except (cv2.error, OSError, ValueError) as exc:
        logger.warning("Attribute detection failed for wardrobe upload %s: %s", stored_image.filename, exc)

    if not payload.dominant_colors and detected_attributes.get("dominant_colors"):
        payload = payload.model_copy(
            update={"dominant_colors": detected_attributes["dominant_colors"]},
        )
    detected_color_hex = (
        detected_attributes.get("dominant_color_hex", [])
        if not (dominant_colors or [])
        else []
    )
    if not payload.sub_type and detected_attributes.get("sub_type"):
        payload = payload.model_copy(update={"sub_type": detected_attributes["sub_type"]})
    if not payload.occasion_tags and detected_attributes.get("occasion_tags"):
        payload = payload.model_copy(
            update={"occasion_tags": detected_attributes["occasion_tags"]},
        )

    item_id = ObjectId()
    image_url = f"{settings.api_prefix}/wardrobe/{item_id}/image"
    now = datetime.now(UTC)
    document = {
        **payload.model_dump(mode="json"),
        "_id": item_id,
        "user_id": str(current_user["_id"]),
        "image_filename": stored_image.filename,
        "image_media_type": stored_image.media_type,
        "image_url": image_url,
        "pattern": detected_attributes.get("pattern"),
        "sleeve_length": detected_attributes.get("sleeve_length"),
        "attribute_summary": detected_attributes.get("attribute_summary"),
        "dominant_color_hex": detected_color_hex,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await get_database()["clothing_items"].insert_one(document)
    except PyMongoError as exc:
        try:
            await image_storage.delete(stored_image.filename)
        except OSError:
            logger.exception("Could not remove an image after a failed wardrobe insert")
        logger.exception("Could not create wardrobe item")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your wardrobe item could not be saved.",
        ) from exc

    document["_id"] = result.inserted_id
    return _to_item_response(document)


@router.get("/{item_id}/image")
async def read_wardrobe_image(
    item_id: str,
    current_user: CurrentUser,
) -> Response:
    """Serve an item's image only to its owning authenticated user."""
    object_id = _parse_item_id(item_id)
    try:
        document = await get_database()["clothing_items"].find_one(
            {"_id": object_id, "user_id": str(current_user["_id"])}
        )
    except PyMongoError as exc:
        logger.exception("Could not look up wardrobe image")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The wardrobe image is temporarily unavailable.",
        ) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wardrobe item not found.",
        )
    try:
        return await image_storage.response_for(
            document["image_filename"],
            document.get("image_media_type", "application/octet-stream"),
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wardrobe image not found.",
        ) from exc
    except OSError as exc:
        logger.exception("Could not access the stored wardrobe image")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The wardrobe image is temporarily unavailable.",
        ) from exc
    except (KeyError, ValueError) as exc:
        logger.exception("Wardrobe item contains an invalid image reference")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored wardrobe image reference is invalid.",
        ) from exc


@router.patch("/{item_id}", response_model=WardrobeItemResponse)
async def update_wardrobe_item(
    item_id: str,
    payload: WardrobeItemUpdate,
    current_user: CurrentUser,
) -> WardrobeItemResponse:
    """Update supplied metadata fields on an owned wardrobe item."""
    object_id = _parse_item_id(item_id)
    updates = payload.model_dump(mode="json", exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update.",
        )
    try:
        result = await get_database()["clothing_items"].find_one_and_update(
            {"_id": object_id, "user_id": str(current_user["_id"])},
            {"$set": {**updates, "updated_at": datetime.now(UTC)}},
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError as exc:
        logger.exception("Could not update wardrobe item")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your wardrobe item could not be updated.",
        ) from exc
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wardrobe item not found.",
        )
    return _to_item_response(result)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wardrobe_item(
    item_id: str,
    current_user: CurrentUser,
) -> Response:
    """Delete an owned wardrobe item and its associated local image."""
    object_id = _parse_item_id(item_id)
    try:
        document = await get_database()["clothing_items"].find_one_and_delete(
            {"_id": object_id, "user_id": str(current_user["_id"])}
        )
    except PyMongoError as exc:
        logger.exception("Could not delete wardrobe item")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your wardrobe item could not be deleted.",
        ) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wardrobe item not found.",
        )
    try:
        await image_storage.delete(document["image_filename"])
    except KeyError as exc:
        logger.exception("Deleted wardrobe item did not contain an image reference")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The item was deleted, but its image reference is invalid.",
        ) from exc
    except (OSError, ValueError):
        logger.exception("Wardrobe item was deleted but its image could not be removed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The item was deleted, but its image could not be removed.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
