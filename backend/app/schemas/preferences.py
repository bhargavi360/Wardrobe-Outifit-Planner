"""Request and response schemas for personal style preferences."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PreferredStyle(StrEnum):
    """Style categories supported by the preference form."""

    CASUAL = "casual"
    FORMAL = "formal"
    SPORTY = "sporty"
    ETHNIC = "ethnic"


def normalize_colors(values: list[str]) -> list[str]:
    """Trim and deduplicate color values without changing their display case."""
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        color = value.strip()
        key = color.casefold()
        if color and key not in seen:
            normalized.append(color)
            seen.add(key)
    return normalized


class PreferencesPayload(BaseModel):
    """User-editable style preferences."""

    model_config = ConfigDict(str_strip_whitespace=True)

    favorite_colors: list[str] = Field(default_factory=list, max_length=20)
    preferred_styles: list[PreferredStyle] = Field(default_factory=list, max_length=4)
    disliked_colors: list[str] = Field(default_factory=list, max_length=20)
    gender_fit_notes: str = Field(default="", max_length=1000)

    @field_validator("favorite_colors", "disliked_colors")
    @classmethod
    def validate_colors(cls, values: list[str]) -> list[str]:
        colors = normalize_colors(values)
        if any(len(color) > 32 for color in colors):
            raise ValueError("Color names must be 32 characters or fewer.")
        return colors

    @field_validator("preferred_styles")
    @classmethod
    def deduplicate_styles(
        cls,
        values: list[PreferredStyle],
    ) -> list[PreferredStyle]:
        return list(dict.fromkeys(values))


class PreferencesResponse(PreferencesPayload):
    """Saved style preferences associated with the current user."""

    user_id: str
