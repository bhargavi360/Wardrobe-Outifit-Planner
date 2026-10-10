"""Schemas for saved outfit persistence and update operations."""

from __future__ import annotations

from typing import Literal
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.outfit_recommendation import OccasionType

SavedCategory = Literal["top", "bottom", "dress", "outerwear", "footwear", "accessory"]


class SavedOutfitItem(BaseModel):
    """A single wardrobe item inside a saved outfit."""

    model_config = ConfigDict(str_strip_whitespace=True)

    item_id: str = Field(min_length=1, max_length=100)
    category: SavedCategory
    name: str = Field(min_length=1, max_length=80)
    dominant_colors: list[str] = Field(default_factory=list, max_length=5)
    sub_type: str | None = Field(default=None, max_length=60)


class SavedOutfitCreate(BaseModel):
    """Payload used to create a saved outfit."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=80)
    occasion: OccasionType = OccasionType.CASUAL
    items: list[SavedOutfitItem] = Field(min_length=1, max_length=12)
    notes: str = Field(default="", max_length=500)
    is_favorite: bool = False


class SavedOutfitUpdate(BaseModel):
    """Partial update payload for saved outfits."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=80)
    occasion: OccasionType | None = None
    items: list[SavedOutfitItem] | None = Field(default=None, max_length=12)
    notes: str | None = Field(default=None, max_length=500)
    is_favorite: bool | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "SavedOutfitUpdate":
        for field_name in ("name", "occasion", "items", "notes", "is_favorite"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        if "items" in self.model_fields_set and not self.items:
            raise ValueError("items must contain at least one wardrobe item.")
        return self


class SavedOutfitResponse(BaseModel):
    """Saved outfit document returned by the API."""

    id: str
    user_id: str
    name: str
    occasion: OccasionType
    items: list[SavedOutfitItem]
    notes: str
    is_favorite: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
