"""Machine-learning classification service for wardrobe item categories."""

from __future__ import annotations

import asyncio
import io
import sys
import warnings
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.services.storage import MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, SUPPORTED_FORMATS

REPO_ROOT = Path(__file__).resolve().parents[3]
ML_SRC_PATH = REPO_ROOT / "ml" / "src"
if str(ML_SRC_PATH) not in sys.path:
    sys.path.insert(0, str(ML_SRC_PATH))


class ClassificationError(RuntimeError):
    """Raised when the submitted image cannot be classified."""


class ClassificationUnavailableError(RuntimeError):
    """Raised when trained model weights or inference dependencies are unavailable."""


@lru_cache(maxsize=1)
def _get_classifier() -> Any:
    """Load the ML stack only when inference is requested, not during API startup."""
    from wardrobe_ml.classifier import ClothingClassifier

    return ClothingClassifier(
        model_path=REPO_ROOT / "ml" / "artifacts" / "clothing_classifier_state.pth",
    )


def _predict_image(image: Image.Image) -> dict[str, Any]:
    try:
        classifier = _get_classifier()
    except (FileNotFoundError, ModuleNotFoundError, OSError, RuntimeError, ValueError) as exc:
        raise ClassificationUnavailableError(
            "The trained clothing classifier is unavailable. Train the model and install "
            "the ML dependencies before retrying.",
        ) from exc
    try:
        return classifier.predict(ImageOps.exif_transpose(image).convert("RGB"))
    except (ModuleNotFoundError, OSError, RuntimeError, ValueError) as exc:
        raise ClassificationUnavailableError(
            "The clothing classifier could not complete inference.",
        ) from exc


def _decode_image(contents: bytes) -> Image.Image:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(contents)) as image:
                if image.format not in SUPPORTED_FORMATS:
                    raise ClassificationError("Choose a JPEG, PNG, or WebP image.")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise ClassificationError("Image dimensions exceed the 40 megapixel limit.")
                image.load()
                return ImageOps.exif_transpose(image).convert("RGB")
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ClassificationError("Image dimensions exceed the safe processing limit.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ClassificationError("The uploaded file is not a valid image.") from exc


def _predict_bytes(contents: bytes) -> dict[str, Any]:
    return _predict_image(_decode_image(contents))


def _response_payload(result: dict[str, Any]) -> dict[str, Any]:
    category = str(result["category"])
    return {
        "category": category,
        "confidence": round(float(result["confidence"]), 4),
        "label": category,
    }


async def classify_uploaded_image(upload: UploadFile) -> dict[str, Any]:
    """Classify a FastAPI upload and return a deterministic response payload."""
    if upload.filename is None or not upload.filename:
        raise ClassificationError("Please provide an image file to classify.")

    try:
        contents = await upload.read(MAX_IMAGE_BYTES + 1)
    except OSError as exc:
        raise ClassificationError("The uploaded image could not be read.") from exc

    if not contents:
        raise ClassificationError("The uploaded image is empty.")
    if len(contents) > MAX_IMAGE_BYTES:
        raise ClassificationError("Image must be 10 MB or smaller.")

    return _response_payload(await asyncio.to_thread(_predict_bytes, contents))


async def classify_image_file(path: str | Path) -> dict[str, Any]:
    """Classify a local image path using the shared ML model implementation."""
    image_path = Path(path)
    try:
        image = await asyncio.to_thread(_open_image_path, image_path)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ClassificationError(f"Could not classify image at {image_path}.") from exc
    return _response_payload(await asyncio.to_thread(_predict_image, image))


async def classify_image_bytes(contents: bytes) -> dict[str, Any]:
    """Classify raw image bytes without needing an upload object."""
    return _response_payload(await asyncio.to_thread(_predict_bytes, contents))


def _open_image_path(image_path: Path) -> Image.Image:
    with Image.open(image_path) as image:
        return ImageOps.exif_transpose(image).convert("RGB")
