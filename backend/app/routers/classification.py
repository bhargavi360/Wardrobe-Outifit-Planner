"""Routes for classifying wardrobe images with the local ML model."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.auth import get_current_user
from app.schemas.classification import ClassificationResponse
from app.services.classification import (
    ClassificationError,
    ClassificationUnavailableError,
    classify_uploaded_image,
)

router = APIRouter(prefix="/classify", tags=["classification"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


@router.post("", response_model=ClassificationResponse)
async def classify_clothing_image(
    current_user: CurrentUser,
    file: Annotated[UploadFile, File(description="Wardrobe image to classify")],
) -> ClassificationResponse:
    """Run a garment category prediction for the uploaded image."""
    del current_user
    try:
        payload = await classify_uploaded_image(file)
    except ClassificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ClassificationUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return ClassificationResponse(**payload)
