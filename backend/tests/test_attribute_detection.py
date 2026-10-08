"""Tests for foreground, color, and clothing-attribute detection."""

import cv2
import numpy as np

from app.services.attribute_detection import (
    _apply_grabcut,
    _detect_pattern,
    _detect_sleeve_length,
    _extract_dominant_colors,
    analyze_image_file,
)


def test_dominant_colors_are_ranked_and_include_hex_values() -> None:
    image = np.zeros((40, 40, 3), dtype=np.uint8)
    image[:, :28] = (96, 38, 24)  # Navy in BGR.
    image[:, 28:] = (48, 48, 191)  # Red in BGR.
    mask = np.ones((40, 40), dtype=np.uint8)

    palette = _extract_dominant_colors(image, mask)

    assert palette[0][0] == "navy"
    assert len(palette) == 2
    assert all(len(hex_value) == 7 and hex_value.startswith("#") for _, hex_value in palette)


def test_uniform_foreground_is_detected_as_solid() -> None:
    image = np.full((32, 32, 3), (30, 70, 180), dtype=np.uint8)
    mask = np.ones((32, 32), dtype=np.uint8)

    assert _detect_pattern(image, mask) == "solid"


def test_pattern_detection_distinguishes_stripes_and_checks() -> None:
    mask = np.ones((120, 90), dtype=np.uint8)
    stripes = np.full((120, 90, 3), 40, dtype=np.uint8)
    stripes[:, ::8] = 230
    checks = stripes.copy()
    checks[::8, :] = 230

    assert _detect_pattern(stripes, mask) == "striped"
    assert _detect_pattern(checks, mask) == "checked"


def test_grabcut_has_a_safe_fallback_for_small_images() -> None:
    image = np.full((6, 6, 3), 120, dtype=np.uint8)

    mask = _apply_grabcut(image)

    assert mask.shape == (6, 6)
    assert mask.dtype == np.uint8
    assert mask.any()
    assert _detect_sleeve_length(mask, "top") == "unknown"


def test_analysis_uses_supplied_category_and_omits_sleeves_for_bottoms(tmp_path) -> None:
    image = np.zeros((48, 40, 3), dtype=np.uint8)
    image[5:43, 10:30] = (30, 70, 180)
    image_path = tmp_path / "bottom.png"
    assert cv2.imwrite(str(image_path), image)

    attributes = analyze_image_file(image_path, category="bottom")

    assert attributes["sub_type"] == "bottoms"
    assert attributes["sleeve_length"] is None
    assert 1 <= len(attributes["dominant_colors"]) <= 3
    assert len(attributes["dominant_colors"]) == len(attributes["dominant_color_hex"])
    assert attributes["pattern"] in {"solid", "striped", "checked", "unknown"}
