"""Health and readiness endpoint."""

import logging

from fastapi import APIRouter, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.db import get_database
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Report API readiness, including MongoDB connectivity."""
    database = get_database()
    try:
        await database.command("ping")
    except PyMongoError as exc:
        logger.exception("MongoDB health check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        ) from exc

    return HealthResponse(status="ok", database="ok")
