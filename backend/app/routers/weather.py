"""Authenticated city search and current weather, with a manual UI fallback."""
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.auth import get_current_user
from app.services import weather

router = APIRouter(prefix="/weather", tags=["weather"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


@router.get("/locations")
async def locations(current_user: CurrentUser, q: str = Query(min_length=2, max_length=80)) -> list[dict]:
    try:
        return await weather.locations(q.strip())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, "City search is unavailable. You can still enter weather manually.") from exc


@router.get("/current")
async def current(current_user: CurrentUser, latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)) -> dict:
    try:
        return await weather.current_weather(latitude, longitude)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, "Live weather is unavailable. Enter temperature and conditions manually.") from exc
