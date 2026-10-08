"""Schemas for Gemini outfit styling suggestions."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.outfit_recommendation import OccasionType, WeatherCondition


class StylingWeatherInput(BaseModel):
    """Weather values that influence the styling guidance."""

    model_config = ConfigDict(str_strip_whitespace=True)

    temperature_c: float = Field(..., ge=-30, le=60)
    condition: WeatherCondition = WeatherCondition.SUNNY


class StylingItemInput(BaseModel):
    """Minimal wardrobe item passed to the styling service."""

    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=32)
    dominant_colors: list[str] = Field(default_factory=list, max_length=5)
    sub_type: str | None = Field(default=None, max_length=60)


class StylingPreferencesInput(BaseModel):
    """Bounded preference details used to personalize generated tips."""

    model_config = ConfigDict(str_strip_whitespace=True)

    favorite_colors: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list,
        max_length=20,
    )
    disliked_colors: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list,
        max_length=20,
    )
    preferred_styles: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list,
        max_length=4,
    )


class StylingRequest(BaseModel):
    """Optional request payload for outfit styling suggestions."""

    occasion: OccasionType = OccasionType.CASUAL
    weather: StylingWeatherInput
    items: list[StylingItemInput] = Field(min_length=1, max_length=6)
    user_preferences: StylingPreferencesInput | None = None


class StylingTipResponse(BaseModel):
    """Styling guidance returned to the client."""

    styling_tip: str
    accessory_suggestions: list[str]
    why_it_works: str
    source: str = "fallback"
