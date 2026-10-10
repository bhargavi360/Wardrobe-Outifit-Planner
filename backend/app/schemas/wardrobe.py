"""Wardrobe item request and response schemas."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ClothingCategory(StrEnum):
    """Normalized wardrobe categories shared by the API and classifier."""

    TOP = "top"
    BOTTOM = "bottom"
    DRESS = "dress"
    OUTERWEAR = "outerwear"
    FOOTWEAR = "footwear"
    ACCESSORY = "accessory"


class Season(StrEnum):
    """Seasonal suitability for an item."""

    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"
    ALL_SEASON = "all-season"


def _clean_string_list(values: list[str], max_entries: int) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        entry = value.strip()
        key = entry.casefold()
        if entry and key not in seen:
            cleaned.append(entry)
            seen.add(key)
    if len(cleaned) > max_entries:
        raise ValueError(f"Choose no more than {max_entries} values.")
    return cleaned


class WardrobeItemCreate(BaseModel):
    """Validated clothing metadata supplied when uploading an image."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: Annotated[str, Field(min_length=1, max_length=80)]
    category: ClothingCategory
    sub_type: Annotated[str | None, Field(max_length=60)] = None
    dominant_colors: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list,
        max_length=5,
    )
    season: Season = Season.ALL_SEASON
    occasion_tags: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list,
        max_length=10,
    )
    user_notes: Annotated[str, Field(max_length=1000)] = ""

    @field_validator("dominant_colors")
    @classmethod
    def clean_colors(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values, 5)

    @field_validator("occasion_tags")
    @classmethod
    def clean_occasion_tags(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values, 10)


class WardrobeItemUpdate(BaseModel):
    """Partial metadata update for an existing clothing item."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    category: ClothingCategory | None = None
    sub_type: Annotated[str, Field(max_length=60)] | None = None
    dominant_colors: list[Annotated[str, Field(max_length=32)]] | None = Field(
        default=None,
        max_length=5,
    )
    season: Season | None = None
    occasion_tags: list[Annotated[str, Field(max_length=32)]] | None = Field(
        default=None,
        max_length=10,
    )
    user_notes: Annotated[str, Field(max_length=1000)] | None = None
    availability: Literal["available", "laundry"] | None = None

    @model_validator(mode="after")
    def reject_null_required_values(self) -> "WardrobeItemUpdate":
        for field_name in (
            "name",
            "category",
            "dominant_colors",
            "season",
            "occasion_tags",
            "user_notes",
            "availability",
        ):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self

    @field_validator("dominant_colors")
    @classmethod
    def clean_colors(cls, values: list[str] | None) -> list[str] | None:
        return None if values is None else _clean_string_list(values, 5)

    @field_validator("occasion_tags")
    @classmethod
    def clean_occasion_tags(
        cls,
        values: list[str] | None,
    ) -> list[str] | None:
        return None if values is None else _clean_string_list(values, 10)


class WardrobeItemResponse(BaseModel):
    """Public representation of a clothing item belonging to the user."""

    id: str
    name: str
    image_url: str
    category: ClothingCategory
    sub_type: str | None = None
    dominant_colors: list[str]
    season: Season
    occasion_tags: list[str]
    user_notes: str
    created_at: datetime
    dominant_color_hex: list[str] = Field(default_factory=list)
    pattern: Literal["solid", "striped", "checked", "unknown"] | None = None
    sleeve_length: Literal["short", "long", "unknown"] | None = None
    attribute_summary: str | None = None
    availability: Literal["available", "laundry"] = "available"
