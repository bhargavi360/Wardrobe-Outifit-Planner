"""Train and evaluate a MobileNetV2 baseline on Fashion-MNIST."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import torch
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix
from torch import nn
from torch.nn import functional as torch_functional
from torch.utils.data import DataLoader, Dataset, Subset
from torchvision import datasets, transforms

from wardrobe_ml.model import CLASS_LABELS, MODEL_INPUT_SIZE, build_model

REPO_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = REPO_ROOT / "ml" / "artifacts"
FASHIONMNIST_CATEGORY_MAP: dict[int, str | None] = {
    0: "top",       # T-shirt/top
    1: "bottom",    # Trouser
    2: "top",       # Pullover
    3: "dress",     # Dress
    4: "outerwear", # Coat
    5: "footwear",  # Sandal
    6: "top",       # Shirt
    7: "footwear",  # Sneaker
    8: None,        # Bag is not a clothing category
    9: "footwear",  # Ankle boot
}
CLASS_TO_INDEX = {label: index for index, label in enumerate(CLASS_LABELS)}


class MappedFashionMNIST(Dataset[tuple[torch.Tensor, int]]):
    """Fashion-MNIST view with bags excluded and labels mapped to wardrobe types."""

    def __init__(self, dataset: Dataset[tuple[Image.Image, int]]) -> None:
        self.dataset = dataset
        targets = getattr(dataset, "targets")
        self.indices = [
            index
            for index, label in enumerate(targets)
            if FASHIONMNIST_CATEGORY_MAP[int(label)] is not None
        ]

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        image, original_label = self.dataset[self.indices[index]]
        category = FASHIONMNIST_CATEGORY_MAP[int(original_label)]
        if category is None:
            raise ValueError("The bag class must not be included in the classifier dataset.")
        return image, CLASS_TO_INDEX[category]


def _image_transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Grayscale(num_output_channels=3),
            transforms.Resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )


def load_datasets(data_dir: Path) -> tuple[MappedFashionMNIST, MappedFashionMNIST]:
    """Download (if needed) and prepare the train and official test splits."""
    transform = _image_transform()
    train_data = datasets.FashionMNIST(
        root=str(data_dir),
        train=True,
        download=True,
        transform=transform,
    )
    test_data = datasets.FashionMNIST(
        root=str(data_dir),
        train=False,
        download=True,
        transform=transform,
    )
    return MappedFashionMNIST(train_data), MappedFashionMNIST(test_data)


def _limit_dataset(dataset: Dataset[tuple[torch.Tensor, int]], limit: int | None) -> Dataset[tuple[torch.Tensor, int]]:
    if limit is None:
        return dataset
    if limit < 1:
        raise ValueError("--max-train-samples must be greater than zero.")
    return Subset(dataset, range(min(limit, len(dataset))))


def _run_training_epoch(
    model: nn.Module,
    loader: DataLoader[tuple[torch.Tensor, torch.Tensor]],
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
) -> float:
    model.train()
    model.features.eval()
    total_loss = 0.0
    total_examples = 0
    for images, targets in loader:
        images, targets = images.to(device), targets.to(device)
        optimizer.zero_grad(set_to_none=True)
        with torch.no_grad():
            features = model.features(images)
            features = torch_functional.adaptive_avg_pool2d(features, (1, 1)).flatten(1)
        logits = model.classifier(features)
        loss = criterion(logits, targets)
        loss.backward()
        optimizer.step()
        total_loss += float(loss.item()) * len(targets)
        total_examples += len(targets)
    return total_loss / total_examples


@torch.inference_mode()
def evaluate(
    model: nn.Module,
    loader: DataLoader[tuple[torch.Tensor, torch.Tensor]],
    device: torch.device,
) -> dict[str, Any]:
    """Return accuracy and a fixed-order confusion matrix for the test split."""
    model.eval()
    predictions: list[int] = []
    expected: list[int] = []
    for images, targets in loader:
        logits = model(images.to(device))
        predictions.extend(logits.argmax(dim=1).cpu().tolist())
        expected.extend(targets.tolist())
    matrix = confusion_matrix(
        expected,
        predictions,
        labels=list(range(len(CLASS_LABELS))),
    )
    return {
        "accuracy": float(accuracy_score(expected, predictions)),
        "confusion_matrix": matrix.tolist(),
        "class_labels": list(CLASS_LABELS),
        "evaluated_samples": len(expected),
    }


def train(
    *,
    data_dir: Path,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    max_train_samples: int | None = None,
) -> dict[str, Any]:
    """Train the classification head and save weights plus evaluation metadata."""
    if epochs < 1 or batch_size < 1 or learning_rate <= 0:
        raise ValueError("Epochs, batch size, and learning rate must all be positive.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_data, test_data = load_datasets(data_dir)
    train_data = _limit_dataset(train_data, max_train_samples)
    train_loader = DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_data, batch_size=batch_size, shuffle=False, num_workers=0)

    model = build_model(pretrained=True).to(device)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=learning_rate)

    epoch_losses = [
        _run_training_epoch(model, train_loader, optimizer, criterion, device)
        for _ in range(epochs)
    ]
    metrics = evaluate(model, test_loader, device)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    weights_path = ARTIFACTS_DIR / "clothing_classifier_state.pth"
    metrics_path = ARTIFACTS_DIR / "clothing_classifier_metrics.json"
    metadata_path = ARTIFACTS_DIR / "clothing_classifier_metadata.json"
    torch.save(
        {
            "model_state_dict": model.cpu().state_dict(),
            "class_labels": list(CLASS_LABELS),
            "input_size": MODEL_INPUT_SIZE,
        },
        weights_path,
    )
    metrics.update(
        {
            "dataset": "Fashion-MNIST test split",
            "train_samples": len(train_data),
            "epochs": epochs,
            "epoch_losses": epoch_losses,
            "device": str(device),
        }
    )
    metadata = {
        "model": "MobileNetV2",
        "pretrained_weights": "MobileNet_V2_Weights.DEFAULT",
        "head": f"Linear(1280, {len(CLASS_LABELS)})",
        "dataset": "Fashion-MNIST",
        "excluded_original_class": "Bag",
        "fashion_mnist_to_category": {
            str(label): category for label, category in FASHIONMNIST_CATEGORY_MAP.items()
        },
        "class_labels": list(CLASS_LABELS),
        "input_size": MODEL_INPUT_SIZE,
        "trained_at": datetime.now(UTC).isoformat(),
    }
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Test accuracy: {metrics['accuracy']:.4f}")
    print("Confusion matrix (rows=true, columns=predicted):")
    for label, row in zip(CLASS_LABELS, metrics["confusion_matrix"], strict=True):
        print(f"{label:>10}: {row}")
    print(f"Saved weights to {weights_path}")
    print(f"Saved metrics to {metrics_path}")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=REPO_ROOT / ".cache" / "fashion-mnist")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--max-train-samples", type=int, default=None)
    args = parser.parse_args()
    train(
        data_dir=args.data_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        max_train_samples=args.max_train_samples,
    )


if __name__ == "__main__":
    main()
