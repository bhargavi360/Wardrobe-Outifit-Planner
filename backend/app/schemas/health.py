"""Health endpoint response schema."""

from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """API and database readiness status."""

    status: Literal["ok"]
    database: Literal["ok"]
