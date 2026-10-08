"""FastAPI application factory and lifecycle hooks."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import close_mongo_connection, connect_to_mongo
from app.core.security import validate_jwt_secret_key
from app.routers.auth import router as auth_router
from app.routers.classification import router as classification_router
from app.routers.health import router as health_router
from app.routers.outfits import router as outfits_router
from app.routers.preferences import router as preferences_router
from app.routers.saved_outfits import router as saved_outfits_router
from app.routers.styling import router as styling_router
from app.routers.wardrobe import router as wardrobe_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize required infrastructure before serving requests."""
    validate_jwt_secret_key(settings.jwt_secret_key.get_secret_value())
    await connect_to_mongo()
    try:
        yield
    finally:
        await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API for the Smart Wardrobe and Outfit Planner.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(preferences_router, prefix=settings.api_prefix)
app.include_router(classification_router, prefix=settings.api_prefix)
app.include_router(outfits_router, prefix=settings.api_prefix)
app.include_router(saved_outfits_router, prefix=settings.api_prefix)
app.include_router(styling_router, prefix=settings.api_prefix)
app.include_router(wardrobe_router, prefix=settings.api_prefix)
