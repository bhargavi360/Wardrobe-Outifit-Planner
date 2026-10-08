"""Shared MobileNetV2 model definition and category labels."""

from __future__ import annotations

from torch import nn
from torchvision.models import MobileNet_V2_Weights, mobilenet_v2

CLASS_LABELS = ("top", "bottom", "dress", "outerwear", "footwear")
MODEL_INPUT_SIZE = 96


def build_model(*, pretrained: bool) -> nn.Module:
    """Build MobileNetV2 with a classification head for wardrobe categories."""
    weights = MobileNet_V2_Weights.DEFAULT if pretrained else None
    model = mobilenet_v2(weights=weights)
    input_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(input_features, len(CLASS_LABELS))
    return model
