"""Classification request and response schemas."""

from pydantic import BaseModel, Field


class ClassificationResponse(BaseModel):
    """Inference output for a wardrobe image."""

    category: str
    confidence: float = Field(ge=0.0, le=1.0)
    label: str | None = None

    @property
    def normalized_category(self) -> str:
        return self.label or self.category
