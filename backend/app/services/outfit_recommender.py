"""Rule-based outfit recommendation engine for wardrobe planning."""

from __future__ import annotations

import colorsys
from collections import Counter, defaultdict
from itertools import product
from typing import Any

from app.schemas.outfit_recommendation import (
    OccasionType,
    OutfitReason,
    WeatherCondition,
)

OCCASION_COMPATIBILITY: dict[OccasionType, dict[str, float]] = {
    OccasionType.CASUAL: {"top": 1.1, "bottom": 1.0, "dress": 1.0, "outerwear": 0.9, "footwear": 0.9},
    OccasionType.FORMAL: {"top": 1.2, "bottom": 1.1, "dress": 1.3, "outerwear": 1.1, "footwear": 1.1},
    OccasionType.PARTY: {"top": 1.1, "bottom": 1.0, "dress": 1.3, "outerwear": 0.9, "footwear": 1.0},
    OccasionType.GYM: {"top": 1.2, "bottom": 1.2, "dress": 0.6, "outerwear": 0.7, "footwear": 1.3},
    OccasionType.ETHNIC: {"top": 1.2, "bottom": 1.0, "dress": 1.4, "outerwear": 1.0, "footwear": 1.1},
}

COLOR_NAME_TO_HUE = {
    "red": 0,
    "orange": 25,
    "yellow": 55,
    "lime": 90,
    "green": 120,
    "teal": 175,
    "cyan": 185,
    "blue": 215,
    "navy": 225,
    "purple": 275,
    "magenta": 300,
    "pink": 330,
    "beige": 38,
    "tan": 32,
    "brown": 25,
    "cream": 45,
    "ivory": 45,
    "olive": 75,
    "burgundy": 350,
}
NEUTRAL_COLORS = {
    "black",
    "white",
    "gray",
    "grey",
    "cream",
    "ivory",
    "beige",
    "tan",
    "brown",
    "charcoal",
    "navy",
    "neutral",
}
_MAX_ITEMS_PER_CATEGORY = 12
_MAX_FOOTWEAR_OPTIONS = 8
_MAX_OUTERWEAR_OPTIONS = 8


def _normalized_color(color: str) -> str:
    return " ".join(color.strip().casefold().replace("-", " ").split())


def _color_hue_and_neutral(color: str) -> tuple[float, bool]:
    normalized = _normalized_color(color)
    if normalized.startswith("#"):
        hex_value = normalized[1:]
        if len(hex_value) == 3:
            hex_value = "".join(character * 2 for character in hex_value)
        if len(hex_value) == 6:
            try:
                red, green, blue = (
                    int(hex_value[index : index + 2], 16) / 255
                    for index in (0, 2, 4)
                )
            except ValueError:
                pass
            else:
                hue, saturation, _ = colorsys.rgb_to_hsv(red, green, blue)
                return hue * 360, saturation < 0.15

    if normalized in NEUTRAL_COLORS:
        return COLOR_NAME_TO_HUE.get(normalized, 0), True
    hue = COLOR_NAME_TO_HUE.get(normalized)
    if hue is not None:
        return float(hue), False

    # Unknown names should not silently be treated as a specific hue.
    return 0.0, True


def _hue_distance(a: str, b: str) -> float:
    hue_a, _ = _color_hue_and_neutral(a)
    hue_b, _ = _color_hue_and_neutral(b)
    delta = abs(hue_a - hue_b) % 360
    return min(delta, 360 - delta)


def _color_harmony(top_color: str, bottom_color: str) -> tuple[float, str]:
    top = _normalized_color(top_color or "neutral")
    bottom = _normalized_color(bottom_color or "neutral")
    _, top_neutral = _color_hue_and_neutral(top)
    _, bottom_neutral = _color_hue_and_neutral(bottom)
    if top_neutral or bottom_neutral:
        return 1.2, "neutral pairing"

    distance = _hue_distance(top, bottom)
    if distance <= 30:
        return 1.25, "analogous pairing"
    if distance >= 150:
        return 1.15, "complementary pairing"
    if distance <= 90:
        return 1.05, "balanced contrast"
    return 0.7, "clashing palette"


def _item_identity(item: dict[str, Any]) -> str:
    return str(
        item.get(
            "__recommendation_id",
            item.get("_id", item.get("id", "")),
        )
    )


def _item_text(item: dict[str, Any]) -> str:
    values = (
        item.get("name", ""),
        item.get("sub_type", ""),
        item.get("material", ""),
        item.get("fabric", ""),
        *item.get("occasion_tags", []),
    )
    return " ".join(str(value) for value in values if value).casefold().replace("-", " ")


def _occasion_score(occasion: OccasionType, item: dict[str, Any]) -> float:
    category = str(item.get("category", "")).casefold()
    score = OCCASION_COMPATIBILITY.get(occasion, {}).get(category, 0.5)
    tags = {
        str(tag).strip().casefold()
        for tag in item.get("occasion_tags", [])
        if str(tag).strip()
    }
    if occasion.value in tags:
        score += 0.35
    return score


def _weather_adjustments(
    temperature_c: float,
    condition: WeatherCondition,
    item: dict[str, Any],
) -> list[tuple[float, str]]:
    category = str(item.get("category", "")).casefold()
    text = _item_text(item)
    adjustments: list[tuple[float, str]] = []
    cold = temperature_c <= 8 or condition == WeatherCondition.COLD
    hot = temperature_c >= 28

    if cold:
        if category == "outerwear":
            adjustments.append((0.7, "cold-weather layer"))
        if any(term in text for term in ("short sleeve", "sleeveless", "shorts")):
            adjustments.append((-0.35, "less suited to cold weather"))
    elif hot:
        if category == "outerwear":
            adjustments.append((-0.75, "extra layer in warm weather"))
        if category == "top" and any(
            term in text
            for term in ("short sleeve", "sleeveless", "t shirt", "tee", "linen", "cotton")
        ):
            adjustments.append((0.3, "lightweight-style piece for warm weather"))

    if condition == WeatherCondition.RAINY:
        if any(term in text for term in ("suede",)):
            adjustments.append((-0.8, "suede is less suited to rain"))
        if category == "outerwear":
            adjustments.append((0.25, "weather-ready outer layer"))
        if any(term in text for term in ("waterproof", "rain boot", "rubber")):
            adjustments.append((0.25, "rain-ready piece"))

    if condition == WeatherCondition.WINDY and category == "outerwear":
        adjustments.append((0.45, "wind-ready outer layer"))

    return adjustments


def _preference_adjustment(
    item: dict[str, Any],
    preferences: dict[str, Any],
) -> tuple[float, list[str]]:
    colors = {
        _normalized_color(str(color))
        for color in item.get("dominant_colors", [])
        if str(color).strip()
    }
    favorite = {
        _normalized_color(str(color))
        for color in preferences.get("favorite_colors", [])
        if str(color).strip()
    }
    disliked = {
        _normalized_color(str(color))
        for color in preferences.get("disliked_colors", [])
        if str(color).strip()
    }

    matched_favorites = sorted(colors & favorite)
    matched_disliked = sorted(colors & disliked)
    score = min(0.9, len(matched_favorites) * 0.45)
    score -= min(1.5, len(matched_disliked) * 0.8)
    reasons = [f"favorite color: {color}" for color in matched_favorites]
    reasons.extend(f"disliked color: {color}" for color in matched_disliked)
    return score, reasons


def _pair_color_score(
    first: dict[str, Any],
    second: dict[str, Any],
) -> tuple[float, str]:
    first_colors = first.get("dominant_colors") or ["neutral"]
    second_colors = second.get("dominant_colors") or ["neutral"]
    pair_scores = [
        _color_harmony(str(color_a), str(color_b))
        for color_a, color_b in product(first_colors[:3], second_colors[:3])
    ]
    if not pair_scores:
        return 1.0, "balanced palette"
    score = sum(value for value, _ in pair_scores) / len(pair_scores)
    label = Counter(label for _, label in pair_scores).most_common(1)[0][0]
    return score, label


def _candidate_from_items(
    items: list[dict[str, Any]],
    occasion: OccasionType,
    preferences: dict[str, Any],
    item_metrics: dict[str, tuple[float, list[tuple[float, str]], float, list[str]]],
    harmony_cache: dict[tuple[str, str], tuple[float, str]],
) -> dict[str, Any]:
    if not items:
        raise ValueError("At least one item is required to build a candidate outfit.")

    reasons: list[dict[str, Any]] = []
    per_item_occasion_score = 5.0 / len(items)
    for item in items:
        name = str(item.get("name") or item.get("category") or "item")
        occasion_score, weather_adjustments, preference_score, preference_reasons = (
            item_metrics[_item_identity(item)]
        )
        reasons.append(
            {
                "label": f"{name} occasion fit",
                "score": round(occasion_score * per_item_occasion_score, 2),
            }
        )
        for adjustment, label in weather_adjustments:
            reasons.append({"label": f"{name}: {label}", "score": adjustment})
        if preference_score:
            reasons.append(
                {
                    "label": f"{name} preference match",
                    "score": round(preference_score, 2),
                }
            )
        reasons.extend(
            {"label": label, "score": 0.0} for label in preference_reasons
        )

    preferred_styles = {
        str(style).strip().casefold()
        for style in preferences.get("preferred_styles", [])
    }
    if occasion.value in preferred_styles or (
        occasion == OccasionType.GYM and "sporty" in preferred_styles
    ):
        reasons.append(
            {
                "label": f"matches preferred style: {occasion.value}",
                "score": 0.35,
            }
        )

    garments = [
        item
        for item in items
        if str(item.get("category", "")).casefold() != "footwear"
    ]
    harmony_scores = []
    for index, first in enumerate(garments):
        for second in garments[index + 1 :]:
            key = tuple(sorted((_item_identity(first), _item_identity(second))))
            if key not in harmony_cache:
                harmony_cache[key] = _pair_color_score(first, second)
            harmony_scores.append(harmony_cache[key])
    if harmony_scores:
        harmony_score = sum(score for score, _ in harmony_scores) / len(harmony_scores)
        harmony_label = Counter(
            label for _, label in harmony_scores
        ).most_common(1)[0][0]
        reasons.append(
            {
                "label": f"color harmony: {harmony_label}",
                "score": round((harmony_score - 1.0) * 2.0, 2),
            }
        )

    total_score = round(sum(reason["score"] for reason in reasons), 2)
    return {"items": items, "score": total_score, "reasons": reasons}


def _shortlist(
    items: list[dict[str, Any]],
    occasion: OccasionType,
    temperature_c: float,
    condition: WeatherCondition,
    preferences: dict[str, Any],
    limit: int,
) -> list[dict[str, Any]]:
    def priority(item: dict[str, Any]) -> tuple[float, str]:
        weather_score = sum(
            value for value, _ in _weather_adjustments(temperature_c, condition, item)
        )
        preference_score, _ = _preference_adjustment(item, preferences)
        return (
            _occasion_score(occasion, item) + weather_score + preference_score,
            _item_identity(item),
        )

    return sorted(items, key=priority, reverse=True)[:limit]


def build_candidate_outfits(
    wardrobe_items: list[dict[str, Any]],
    occasion: OccasionType,
    temperature_c: float,
    condition: WeatherCondition,
    preferences: dict[str, Any] | None = None,
    required_item_id: str | None = None,
) -> list[dict[str, Any]]:
    """Build and rank distinct outfit combinations from wardrobe items."""
    prefs = preferences or {}
    by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    allowed_categories = {"top", "bottom", "dress", "outerwear", "footwear", "accessory"}
    required_item = None
    for index, original_item in enumerate(wardrobe_items):
        if original_item.get("availability", "available") != "available":
            continue
        category = str(original_item.get("category", "")).casefold()
        if category not in allowed_categories:
            continue
        item = dict(original_item)
        item["category"] = category
        item.setdefault(
            "__recommendation_id",
            str(item.get("_id", item.get("id", f"wardrobe-{index}"))),
        )
        by_category[category].append(item)
        if _item_identity(item) == required_item_id:
            required_item = item

    if required_item_id is not None and required_item is None:
        return []

    def shortlist(category: str, limit: int) -> list[dict[str, Any]]:
        if required_item is not None and required_item["category"] == category:
            return [required_item]
        return _shortlist(
            by_category[category], occasion, temperature_c, condition, prefs, limit
        )

    tops = shortlist("top", _MAX_ITEMS_PER_CATEGORY)
    bottoms = shortlist("bottom", _MAX_ITEMS_PER_CATEGORY)
    dresses = shortlist("dress", _MAX_ITEMS_PER_CATEGORY)
    footwear = shortlist("footwear", _MAX_FOOTWEAR_OPTIONS)
    if required_item is not None:
        if required_item["category"] in {"top", "bottom"}:
            dresses = []
        elif required_item["category"] == "dress":
            tops = []
            bottoms = []
    should_layer = (
        temperature_c <= 18
        or condition in {WeatherCondition.COLD, WeatherCondition.WINDY, WeatherCondition.RAINY}
        or (required_item is not None and required_item["category"] == "outerwear")
    )
    outerwear = (
        shortlist("outerwear", _MAX_OUTERWEAR_OPTIONS)
        if should_layer
        else []
    )
    footwear_options: list[dict[str, Any] | None] = [None, *footwear]
    outerwear_options: list[dict[str, Any] | None] = [None, *outerwear]
    accessory = []
    if required_item is not None:
        if required_item["category"] == "footwear":
            footwear_options = [required_item]
        elif required_item["category"] == "outerwear":
            outerwear_options = [required_item]
        elif required_item["category"] == "accessory":
            accessory = [required_item]
    selected_items = tops + bottoms + dresses + outerwear + footwear + accessory
    item_metrics = {
        _item_identity(item): (
            _occasion_score(occasion, item),
            _weather_adjustments(temperature_c, condition, item),
            *_preference_adjustment(item, prefs),
        )
        for item in selected_items
    }
    harmony_cache: dict[tuple[str, str], tuple[float, str]] = {}
    candidates: list[dict[str, Any]] = []

    for dress in dresses:
        for layer, shoes in product(outerwear_options, footwear_options):
            outfit = [dress, *accessory]
            if layer is not None:
                outfit.append(layer)
            if shoes is not None:
                outfit.append(shoes)
            candidates.append(
                _candidate_from_items(
                    outfit,
                    occasion,
                    prefs,
                    item_metrics,
                    harmony_cache,
                )
            )

    for top, bottom in product(tops, bottoms):
        for layer, shoes in product(outerwear_options, footwear_options):
            outfit = [top, bottom, *accessory]
            if layer is not None:
                outfit.append(layer)
            if shoes is not None:
                outfit.append(shoes)
            candidates.append(
                _candidate_from_items(
                    outfit,
                    occasion,
                    prefs,
                    item_metrics,
                    harmony_cache,
                )
            )

    ranked = sorted(
        candidates,
        key=lambda candidate: (
            candidate["score"],
            tuple(_item_identity(item) for item in candidate["items"]),
        ),
        reverse=True,
    )
    unique: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set()
    for candidate in ranked:
        signature = tuple(sorted(_item_identity(item) for item in candidate["items"]))
        if signature in seen:
            continue
        seen.add(signature)
        unique.append(candidate)
        if len(unique) == 5:
            break
    return unique


def recommend_outfits(
    wardrobe_items: list[dict[str, Any]],
    occasion: OccasionType,
    temperature_c: float,
    condition: WeatherCondition,
    preferences: dict[str, Any] | None = None,
    required_item_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return up to five ranked outfits with score explanations."""
    candidates = build_candidate_outfits(
        wardrobe_items,
        occasion,
        temperature_c,
        condition,
        preferences,
        required_item_id,
    )
    recommendations = []
    for rank, candidate in enumerate(candidates, start=1):
        recommendations.append(
            {
                "rank": rank,
                "score": candidate["score"],
                "items": [
                    {
                        "id": _item_identity(item),
                        "name": item.get("name", "Unnamed item"),
                        "category": item.get("category", "misc"),
                        "dominant_colors": item.get("dominant_colors", []),
                        "sub_type": item.get("sub_type"),
                        "season": item.get("season"),
                    }
                    for item in candidate["items"]
                ],
                "reasons": [
                    OutfitReason(label=reason["label"], score=reason["score"])
                    for reason in candidate["reasons"]
                ],
            }
        )
    return recommendations
