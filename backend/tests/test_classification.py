"""Tests for the image-classification service and authenticated route."""

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.routers.classification import classify_clothing_image
from app.services import classification


def _image_upload() -> UploadFile:
    image_bytes = io.BytesIO()
    Image.new("RGB", (32, 32), color="navy").save(image_bytes, format="PNG")
    image_bytes.seek(0)
    return UploadFile(filename="shirt.png", file=image_bytes)


class _StubClassifier:
    def predict(self, image: Image.Image) -> dict[str, object]:
        assert image.mode == "RGB"
        return {"category": "top", "confidence": 0.875}


def test_classify_uploaded_image_returns_category_and_confidence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(classification, "_get_classifier", _StubClassifier)

    result = asyncio.run(classification.classify_uploaded_image(_image_upload()))

    assert result == {"category": "top", "confidence": 0.875, "label": "top"}


def test_classify_uploaded_image_rejects_invalid_file() -> None:
    upload = UploadFile(filename="notes.txt", file=io.BytesIO(b"not an image"))

    with pytest.raises(classification.ClassificationError, match="valid image"):
        asyncio.run(classification.classify_uploaded_image(upload))


def test_classify_route_returns_service_unavailable_without_weights(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def missing_weights() -> None:
        raise FileNotFoundError("missing trained model")

    monkeypatch.setattr(classification, "_get_classifier", missing_weights)

    with pytest.raises(HTTPException) as error:
        asyncio.run(classify_clothing_image({}, _image_upload()))

    assert error.value.status_code == 503
    assert "trained clothing classifier is unavailable" in error.value.detail
