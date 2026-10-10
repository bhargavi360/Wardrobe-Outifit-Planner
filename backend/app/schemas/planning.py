"""Calendar and trip inputs, with dates stored as local calendar days."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CalendarInput(BaseModel):
    outfit_id: str = Field(min_length=1, max_length=128)
    status: Literal["planned", "worn"] = "planned"


class TripInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    destination: str = Field(default="", max_length=120)
    start_date: date
    end_date: date
    outfit_ids: list[str] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_dates_and_outfits(self) -> "TripInput":
        if self.end_date < self.start_date:
            raise ValueError("Trip end date must be on or after the start date.")
        self.outfit_ids = list(dict.fromkeys(self.outfit_ids))
        return self


class PackingInput(BaseModel):
    item_id: str = Field(min_length=1, max_length=128)
    packed: bool
