"""MobileNetV2 inference for wardrobe item categories."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import torch
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision import transforms

from wardrobe_ml.model import CLASS_LABELS, MODEL_INPUT_SIZE, build_model

_NORMALIZE = transforms.Normalize(
    mean=[0.485, 0.456, 0.406],
    std=[0.229, 0.224, 0.225],
)


class ClothingClassifier:
    """Load trained MobileNetV2 weights and predict a coarse garment category."""

    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path or (
            Path(__file__).resolve().parents[2]
            / "artifacts"
            / "clothing_classifier_state.pth"
        )
        if not self.model_path.is_file():
            raise FileNotFoundError(
                f"Trained clothing classifier weights were not found at {self.model_path}. "
                "Run ml/src/train_clothing_classifier.py first."
            )

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = build_model(pretrained=False)
        checkpoint = torch.load(
            self.model_path,
            map_location=self.device,
            weights_only=True,
        )
        if isinstance(checkpoint, dict) and "class_labels" in checkpoint:
            if tuple(checkpoint["class_labels"]) != CLASS_LABELS:
                raise ValueError("Classifier checkpoint category labels do not match the active taxonomy.")
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()
        self.transform = transforms.Compose(
            [
                transforms.Grayscale(num_output_channels=3),
                transforms.Resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)),
                transforms.ToTensor(),
                _NORMALIZE,
            ]
        )

    @torch.inference_mode()
    def predict(self, image: Image.Image) -> dict[str, Any]:
        """Return the predicted category and its softmax confidence."""
        normalized_image = ImageOps.exif_transpose(image).convert("RGB")
        tensor = self.transform(normalized_image).unsqueeze(0).to(self.device)
        probabilities = torch.softmax(self.model(tensor), dim=1).squeeze(0)
        index = int(torch.argmax(probabilities).item())
        return {
            "category": CLASS_LABELS[index],
            "confidence": float(probabilities[index].item()),
        }


def _read_image(contents: bytes) -> Image.Image:
    try:
        with Image.open(io.BytesIO(contents)) as image:
            return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("Invalid image content for classification.") from exc


def classify_image(image: Image.Image) -> dict[str, Any]:
    """Classify a PIL image and return ``{category, confidence}``."""
    return ClothingClassifier().predict(image)


def classify_bytes(contents: bytes) -> dict[str, Any]:
    """Classify raw image bytes."""
    return classify_image(_read_image(contents))


__all__ = ["CLASS_LABELS", "ClothingClassifier", "classify_bytes", "classify_image"]
