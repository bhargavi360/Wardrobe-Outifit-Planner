"""Computer-vision attribute extraction for uploaded wardrobe items."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sklearn.cluster import KMeans

MAX_ANALYSIS_SIDE = 768
MAX_COLOR_SAMPLES = 8_000
NAMED_COLORS: dict[str, tuple[int, int, int]] = {
    "black": (20, 20, 20),
    "white": (245, 245, 245),
    "navy": (24, 38, 96),
    "blue": (56, 117, 238),
    "beige": (210, 180, 140),
    "olive": (107, 142, 35),
    "green": (34, 139, 34),
    "brown": (120, 66, 18),
    "red": (191, 48, 48),
    "pink": (214, 122, 173),
    "purple": (108, 52, 131),
    "yellow": (201, 187, 51),
    "orange": (211, 97, 31),
    "gray": (128, 128, 128),
    "charcoal": (54, 69, 79),
    "teal": (0, 128, 128),
    "cream": (240, 235, 214),
}
PATTERNS = {"solid", "striped", "checked", "unknown"}


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def _nearest_named_color(rgb: tuple[int, int, int]) -> str:
    color = np.uint8([[rgb]])
    lab_color = cv2.cvtColor(color, cv2.COLOR_RGB2LAB).astype(np.float32)
    references = np.array(list(NAMED_COLORS.values()), dtype=np.uint8).reshape(1, -1, 3)
    lab_references = cv2.cvtColor(references, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    distances = np.linalg.norm(lab_references - lab_color.reshape(1, 3), axis=1)
    return list(NAMED_COLORS)[int(np.argmin(distances))]


def _resize_for_analysis(image_bgr: np.ndarray) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    longest_side = max(height, width)
    if longest_side > MAX_ANALYSIS_SIDE:
        scale = MAX_ANALYSIS_SIDE / longest_side
        image_bgr = cv2.resize(
            image_bgr,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
    return image_bgr


def _center_crop(image_bgr: np.ndarray) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    left = width // 20
    right = max(left + 1, width - left)
    top = height // 20
    bottom = max(top + 1, height - top)
    return image_bgr[top:bottom, left:right]


def _apply_grabcut(image_bgr: np.ndarray) -> np.ndarray:
    """Return a foreground mask; use a conservative center crop on CV failure."""
    height, width = image_bgr.shape[:2]
    fallback = np.zeros((height, width), dtype=np.uint8)
    top, bottom = height // 10, height - height // 10
    left, right = width // 10, width - width // 10
    fallback[top:bottom, left:right] = 1
    if height < 8 or width < 8:
        return fallback

    margin_x = max(1, width // 20)
    margin_y = max(1, height // 20)
    rect_width = width - 2 * margin_x
    rect_height = height - 2 * margin_y
    if rect_width < 2 or rect_height < 2:
        return fallback

    mask = np.zeros((height, width), dtype=np.uint8)
    background_model = np.zeros((1, 65), dtype=np.float64)
    foreground_model = np.zeros((1, 65), dtype=np.float64)
    try:
        cv2.grabCut(
            image_bgr,
            mask,
            (margin_x, margin_y, rect_width, rect_height),
            background_model,
            foreground_model,
            3,
            cv2.GC_INIT_WITH_RECT,
        )
    except cv2.error:
        return fallback

    foreground = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    if int(foreground.sum()) < max(16, int(height * width * 0.01)):
        return fallback
    return foreground


def _masked_crop(image: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    points = cv2.findNonZero(mask)
    if points is None:
        return image, mask
    x, y, width, height = cv2.boundingRect(points)
    if width < 2 or height < 2:
        return image, mask
    return image[y : y + height, x : x + width], mask[y : y + height, x : x + width]


def _extract_dominant_colors(
    image_bgr: np.ndarray,
    mask: np.ndarray,
) -> list[tuple[str, str]]:
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    valid_pixels = image_rgb[mask.astype(bool)]
    if not len(valid_pixels):
        valid_pixels = image_rgb.reshape(-1, 3)
    if not len(valid_pixels):
        return []

    sample_size = min(len(valid_pixels), MAX_COLOR_SAMPLES)
    indices = np.linspace(0, len(valid_pixels) - 1, sample_size, dtype=np.int32)
    sampled = valid_pixels[indices]
    distinct = np.unique(sampled, axis=0)
    cluster_count = min(3, len(distinct))
    if cluster_count == 1:
        centers = distinct.astype(np.uint8)
        counts = np.array([len(sampled)])
    else:
        model = KMeans(n_clusters=cluster_count, n_init=5, random_state=42)
        cluster_labels = model.fit_predict(sampled)
        centers = np.clip(np.rint(model.cluster_centers_), 0, 255).astype(np.uint8)
        counts = np.bincount(cluster_labels, minlength=cluster_count)

    palette: list[tuple[str, str]] = []
    seen_names: set[str] = set()
    for index in np.argsort(counts)[::-1]:
        rgb = tuple(int(channel) for channel in centers[index])
        name = _nearest_named_color(rgb)
        if name not in seen_names:
            palette.append((name, _rgb_to_hex(rgb)))
            seen_names.add(name)
        if len(palette) == 3:
            break
    return palette


def _detect_pattern(image_bgr: np.ndarray, mask: np.ndarray) -> str:
    """Use foreground color variation and edge direction for a coarse pattern guess."""
    foreground = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)[mask.astype(bool)]
    if len(foreground) < 16:
        return "unknown"
    if float(np.mean(np.std(foreground.astype(np.float32), axis=0))) < 11:
        return "solid"

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gradient_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gradient_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(gradient_x, gradient_y)
    foreground_magnitudes = magnitude[mask.astype(bool)]
    if not len(foreground_magnitudes):
        return "unknown"
    active_edges = (mask.astype(bool)) & (
        magnitude > max(12, float(np.percentile(foreground_magnitudes, 55)))
    )
    if int(active_edges.sum()) < 12:
        return "unknown"

    angle = np.rad2deg(np.arctan2(gradient_y[active_edges], gradient_x[active_edges])) % 180
    horizontal_edges = int(np.sum((angle <= 15) | (angle >= 165)))
    vertical_edges = int(np.sum((angle >= 75) & (angle <= 105)))
    edge_count = len(angle)
    horizontal_ratio = horizontal_edges / edge_count
    vertical_ratio = vertical_edges / edge_count
    if horizontal_ratio >= 0.12 and vertical_ratio >= 0.12:
        return "checked"
    if max(horizontal_ratio, vertical_ratio) >= 0.45:
        return "striped"
    return "unknown"


def _detect_sleeve_length(mask: np.ndarray, category: str) -> str | None:
    """Estimate sleeve extent from the segmented silhouette when it is measurable."""
    if category not in {"top", "outerwear"}:
        return None
    _, garment_mask = _masked_crop(mask, mask)
    height, width = garment_mask.shape
    if height < 24 or width < 16:
        return "unknown"

    row_widths = np.count_nonzero(garment_mask, axis=1)
    max_width = int(row_widths.max(initial=0))
    if max_width == 0:
        return "unknown"
    if float(np.std(row_widths)) / max_width < 0.12:
        return "unknown"
    shoulder_band_end = max(2, int(height * 0.48))
    lower_band_start = int(height * 0.50)
    shoulder_width = int(row_widths[:shoulder_band_end].max(initial=0))
    lower_width = int(np.median(row_widths[lower_band_start:])) if lower_band_start < height else 0
    if shoulder_width == 0:
        return "unknown"
    width_ratio = lower_width / shoulder_width
    if 0.78 <= width_ratio <= 0.94:
        return "long"
    if width_ratio <= 0.58:
        return "short"
    return "unknown"


def _infer_sub_type(category: str, sleeve_length: str | None) -> str | None:
    normalized = category.lower()
    if normalized == "top":
        if sleeve_length == "short":
            return "short-sleeve top"
        if sleeve_length == "long":
            return "long-sleeve top"
        return None
    return {
        "bottom": "bottoms",
        "dress": "dress",
        "outerwear": "outerwear",
        "footwear": "footwear",
    }.get(normalized)


def _summarize_attributes(
    pattern: str,
    sleeve_length: str | None,
    dominant_colors: list[str],
) -> str:
    parts = [f"{pattern} pattern" if pattern != "unknown" else "pattern unclear"]
    if sleeve_length:
        parts.append(f"{sleeve_length} sleeves" if sleeve_length != "unknown" else "sleeve length unclear")
    if dominant_colors:
        parts.append(f"dominant colors: {', '.join(dominant_colors[:3])}")
    return "; ".join(parts) + "."


def analyze_image_file(
    image_path: str | Path,
    category: str = "top",
) -> dict[str, Any]:
    """Analyze an image and return foreground-based garment attributes."""
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image for attribute analysis.")

    image_bgr = _resize_for_analysis(_center_crop(image))
    mask = _apply_grabcut(image_bgr)
    garment, garment_mask = _masked_crop(image_bgr, mask)
    pattern = _detect_pattern(garment, garment_mask)
    sleeve_length = _detect_sleeve_length(garment_mask, category)
    dominant_palette = _extract_dominant_colors(garment, garment_mask)
    dominant_names = [entry[0] for entry in dominant_palette]
    return {
        "dominant_colors": dominant_names,
        "dominant_color_hex": [entry[1] for entry in dominant_palette],
        "pattern": pattern,
        "sleeve_length": sleeve_length,
        "sub_type": _infer_sub_type(category, sleeve_length),
        "attribute_summary": _summarize_attributes(
            pattern,
            sleeve_length,
            dominant_names,
        ),
    }
