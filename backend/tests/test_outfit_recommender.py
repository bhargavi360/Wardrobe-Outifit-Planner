"""Unit tests for outfit recommendation scoring and candidate generation."""

from app.schemas.outfit_recommendation import OccasionType, WeatherCondition
from app.services.outfit_recommender import (
    _color_harmony,
    _occasion_score,
    _preference_adjustment,
    _weather_adjustments,
    build_candidate_outfits,
    recommend_outfits,
)


def _wardrobe() -> list[dict[str, object]]:
    return [
        {"_id": "top-1", "name": "Navy shirt", "category": "top", "sub_type": "shirt", "dominant_colors": ["navy"], "season": "all-season"},
        {"_id": "top-2", "name": "Red tee", "category": "top", "sub_type": "t-shirt", "dominant_colors": ["red"], "season": "summer"},
        {"_id": "bottom-1", "name": "Beige trousers", "category": "bottom", "sub_type": "trousers", "dominant_colors": ["beige"], "season": "all-season"},
        {"_id": "bottom-2", "name": "Olive trousers", "category": "bottom", "sub_type": "trousers", "dominant_colors": ["olive"], "season": "all-season"},
        {"_id": "shoe-1", "name": "White sneakers", "category": "footwear", "sub_type": "sneakers", "dominant_colors": ["white"], "season": "all-season"},
    ]


def test_color_harmony_uses_named_and_hsv_colors() -> None:
    neutral_score, neutral_label = _color_harmony("navy", "beige")
    complementary_score, complementary_label = _color_harmony("#ff0000", "#00ffff")
    assert neutral_label == "neutral pairing"
    assert neutral_score > 1.0
    assert complementary_label == "complementary pairing"
    assert complementary_score > 1.0


def test_occasion_compatibility_rewards_formal_pieces_and_tags() -> None:
    shirt = {"category": "top", "sub_type": "shirt", "dominant_colors": ["navy"]}
    tagged_dress = {"category": "dress", "occasion_tags": ["formal"]}
    assert _occasion_score(OccasionType.FORMAL, shirt) >= 1.1
    assert _occasion_score(OccasionType.FORMAL, tagged_dress) > 1.3


def test_weather_rules_reward_layers_and_light_pieces_and_avoid_suede() -> None:
    coat = {"category": "outerwear", "sub_type": "coat"}
    short_sleeve_top = {"category": "top", "sub_type": "short-sleeve linen shirt"}
    suede_shoes = {"category": "footwear", "sub_type": "suede loafers"}

    assert (0.7, "cold-weather layer") in _weather_adjustments(
        5, WeatherCondition.COLD, coat
    )
    assert any(
        score > 0 and "warm weather" in reason
        for score, reason in _weather_adjustments(32, WeatherCondition.SUNNY, short_sleeve_top)
    )
    assert (-0.8, "suede is less suited to rain") in _weather_adjustments(
        20, WeatherCondition.RAINY, suede_shoes
    )


def test_preferences_boost_favorites_and_penalize_disliked_colors() -> None:
    item = {"dominant_colors": ["Navy", "red"]}
    score, reasons = _preference_adjustment(
        item,
        {"favorite_colors": ["navy"], "disliked_colors": ["red"]},
    )
    assert score < 0
    assert "favorite color: navy" in reasons
    assert "disliked color: red" in reasons


def test_recommendations_return_five_distinct_ranked_mongo_items() -> None:
    recommendations = recommend_outfits(
        wardrobe_items=_wardrobe(),
        occasion=OccasionType.CASUAL,
        temperature_c=22,
        condition=WeatherCondition.CLOUDY,
    )

    assert len(recommendations) == 5
    assert [item["rank"] for item in recommendations] == [1, 2, 3, 4, 5]
    assert [item["score"] for item in recommendations] == sorted(
        (item["score"] for item in recommendations), reverse=True
    )
    signatures = [tuple(piece["id"] for piece in item["items"]) for item in recommendations]
    assert len(set(signatures)) == 5
    assert all(piece["id"] != "" for item in recommendations for piece in item["items"])


def test_reasons_explain_candidate_scores() -> None:
    recommendation = recommend_outfits(
        wardrobe_items=_wardrobe(),
        occasion=OccasionType.CASUAL,
        temperature_c=18,
        condition=WeatherCondition.CLOUDY,
        preferences={"favorite_colors": ["navy"], "preferred_styles": ["casual"]},
    )[0]

    assert sum(reason.score for reason in recommendation["reasons"]) == recommendation["score"]
    assert any("color harmony" in reason.label for reason in recommendation["reasons"])
    assert any("favorite color" in reason.label for reason in recommendation["reasons"])
    assert any("preferred style" in reason.label for reason in recommendation["reasons"])


def test_preference_changes_can_change_the_top_recommendation() -> None:
    wardrobe = [
        {"id": "red-top", "name": "Red top", "category": "top", "dominant_colors": ["red"]},
        {"id": "blue-top", "name": "Blue top", "category": "top", "dominant_colors": ["blue"]},
        {"id": "bottom", "name": "Black trousers", "category": "bottom", "dominant_colors": ["black"]},
    ]
    recommendations = recommend_outfits(
        wardrobe,
        OccasionType.CASUAL,
        22,
        WeatherCondition.SUNNY,
        {"favorite_colors": ["blue"]},
    )
    assert recommendations[0]["items"][0]["id"] == "blue-top"


def test_candidate_generation_handles_dresses_and_incomplete_wardrobes() -> None:
    dress = {"id": "dress", "name": "Green dress", "category": "dress", "dominant_colors": ["green"]}
    candidates = build_candidate_outfits(
        [dress],
        OccasionType.PARTY,
        24,
        WeatherCondition.SUNNY,
    )
    assert len(candidates) == 1
    assert candidates[0]["items"][0]["id"] == "dress"
    assert build_candidate_outfits(
        [{"id": "top", "category": "top"}],
        OccasionType.CASUAL,
        22,
        WeatherCondition.SUNNY,
    ) == []
