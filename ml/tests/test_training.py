"""Tests for the Fashion-MNIST category aggregation."""

import torch
from torch.utils.data import Dataset

from train_clothing_classifier import CLASS_TO_INDEX, MappedFashionMNIST
from wardrobe_ml.model import CLASS_LABELS


class _LabelsDataset(Dataset[tuple[torch.Tensor, int]]):
    targets = torch.arange(10)

    def __len__(self) -> int:
        return len(self.targets)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        return torch.tensor([index]), int(self.targets[index])


def test_fashion_mnist_mapping_excludes_bags_and_groups_dataset_labels() -> None:
    dataset = MappedFashionMNIST(_LabelsDataset())

    assert CLASS_LABELS == ("top", "bottom", "dress", "outerwear", "footwear")
    assert len(dataset) == 9
    assert [dataset[index][1] for index in range(len(dataset))] == [
        CLASS_TO_INDEX["top"],
        CLASS_TO_INDEX["bottom"],
        CLASS_TO_INDEX["top"],
        CLASS_TO_INDEX["dress"],
        CLASS_TO_INDEX["outerwear"],
        CLASS_TO_INDEX["footwear"],
        CLASS_TO_INDEX["top"],
        CLASS_TO_INDEX["footwear"],
        CLASS_TO_INDEX["footwear"],
    ]
