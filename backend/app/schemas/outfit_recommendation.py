"""Schemas for outfit recommendation requests and responses."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class OccasionType(StrEnum):
    """Supported style occasions for recommendation scoring."""

    CASUAL = "casual"
    FORMAL = "formal"
    PARTY = "party"
    GYM = "gym"
    ETHNIC = "ethnic"


class WeatherCondition(StrEnum):
    """Supported manual weather conditions for outfit guidance."""

    SUNNY = "sunny"
    CLOUDY = "cloudy"
    RAINY = "rainy"
    COLD = "cold"
    WINDY = "windy"


class WeatherInput(BaseModel):
    """Manual weather constraints for the outfit recommendation engine."""

    model_config = ConfigDict(str_strip_whitespace=True)

    temperature_c: float = Field(..., ge=-30, le=60)
    condition: WeatherCondition = WeatherCondition.SUNNY


class UserPreferenceSnapshot(BaseModel):
    """User preference snapshot used to boost or penalize outfit options."""

    favorite_colors: list[str] = Field(default_factory=list)
    disliked_colors: list[str] = Field(default_factory=list)
    preferred_styles: list[str] = Field(default_factory=list)
    gender_fit_notes: str = ""


class OutfitRecommendationRequest(BaseModel):
    """Request body for generating outfit recommendations."""

    occasion: OccasionType
    weather: WeatherInput
    user_preferences: UserPreferenceSnapshot | None = None


class OutfitItemSummary(BaseModel):
    """Minimal outfit item representation for response output."""

    id: str
    name: str
    category: str
    dominant_colors: list[str] = Field(default_factory=list)
    sub_type: str | None = None
    season: str | None = None


class OutfitReason(BaseModel):
    """Per-outfit explanation for the recommendation score."""

    label: str
    score: float


class OutfitRecommendation(BaseModel):
    """Single ranked outfit with explanation and score."""

    rank: int
    score: float
    items: list[OutfitItemSummary]
    reasons: list[OutfitReason]


class OutfitRecommendationResponse(BaseModel):
    """Top outfit suggestions returned to the client."""

    recommendations: list[OutfitRecommendation]
