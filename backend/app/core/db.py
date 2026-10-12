"""MongoDB lifecycle with primary-to-mirror writes for local and Atlas data."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ReplaceOne

from app.core.config import settings
from app.models.collections import COLLECTION_NAMES

_client: AsyncIOMotorClient | None = None
_mirror_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | MirroredDatabase | None = None


class MirroredCollection:
    """Read from the primary collection and repeat supported writes to its mirror."""

    _WRITE_METHODS = {
        "bulk_write",
        "delete_many",
        "delete_one",
        "find_one_and_delete",
        "find_one_and_replace",
        "find_one_and_update",
        "insert_many",
        "insert_one",
        "replace_one",
        "update_many",
        "update_one",
    }

    def __init__(self, primary: Any, mirror: Any) -> None:
        self._primary = primary
        self._mirror = mirror

    def __getattr__(self, name: str) -> Any:
        primary_attribute = getattr(self._primary, name)
        if name not in self._WRITE_METHODS:
            return primary_attribute

        mirror_method = getattr(self._mirror, name)

        async def write_to_both(*args: Any, **kwargs: Any) -> Any:
            result = await primary_attribute(*args, **kwargs)
            await mirror_method(*args, **kwargs)
            return result

        return write_to_both


class MirroredDatabase:
    """Database facade that keeps reads primary and sends writes to both stores."""

    def __init__(self, primary: AsyncIOMotorDatabase, mirror: AsyncIOMotorDatabase) -> None:
        self._primary = primary
        self._mirror = mirror

    def __getitem__(self, name: str) -> MirroredCollection:
        return MirroredCollection(self._primary[name], self._mirror[name])

    async def command(self, *args: Any, **kwargs: Any) -> Any:
        result = await self._primary.command(*args, **kwargs)
        await self._mirror.command(*args, **kwargs)
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self._primary, name)


async def _ensure_schema(database: AsyncIOMotorDatabase) -> None:
    existing_collections = set(await database.list_collection_names())
    for collection_name in COLLECTION_NAMES:
        if collection_name not in existing_collections:
            await database.create_collection(collection_name)

    await database["users"].create_index("email", unique=True)
    await database["clothing_items"].create_index([("user_id", 1), ("created_at", -1)])
    await database["outfit_calendar"].create_index([("user_id", 1), ("date", 1)], unique=True)
    await database["trips"].create_index([("user_id", 1), ("start_date", -1)])


async def _copy_primary_data_to_mirror(
    primary: AsyncIOMotorDatabase,
    mirror: AsyncIOMotorDatabase,
) -> None:
    """Upsert existing primary records into the mirror in bounded batches at startup."""
    names = set(COLLECTION_NAMES)
    names.update(await primary.list_collection_names())

    for name in names:
        batch: list[ReplaceOne] = []
        async for document in primary[name].find({}):
            batch.append(ReplaceOne({"_id": document["_id"]}, document, upsert=True))
            if len(batch) == 500:
                await mirror[name].bulk_write(batch, ordered=False)
                batch.clear()
        if batch:
            await mirror[name].bulk_write(batch, ordered=False)


async def connect_to_mongo() -> None:
    """Connect to MongoDB, initialize schemas, and sync existing primary data."""
    global _client, _mirror_client, _database

    if _client is not None:
        return

    primary_client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    mirror_client: AsyncIOMotorClient | None = None
    try:
        await primary_client.admin.command("ping")
        primary_database = primary_client[settings.mongodb_database]
        await _ensure_schema(primary_database)

        if settings.mongodb_mirror_uri and settings.mongodb_mirror_uri != settings.mongodb_uri:
            mirror_client = AsyncIOMotorClient(
                settings.mongodb_mirror_uri,
                serverSelectionTimeoutMS=5000,
            )
            await mirror_client.admin.command("ping")
            mirror_database = mirror_client[settings.mongodb_database]
            await _ensure_schema(mirror_database)
            await _copy_primary_data_to_mirror(primary_database, mirror_database)
            database: AsyncIOMotorDatabase | MirroredDatabase = MirroredDatabase(
                primary_database,
                mirror_database,
            )
        else:
            database = primary_database
    except Exception:
        primary_client.close()
        if mirror_client is not None:
            mirror_client.close()
        raise

    _client = primary_client
    _mirror_client = mirror_client
    _database = database


async def close_mongo_connection() -> None:
    """Close the primary and mirror connections during application shutdown."""
    global _client, _mirror_client, _database

    if _client is not None:
        _client.close()
    if _mirror_client is not None:
        _mirror_client.close()
    _client = None
    _mirror_client = None
    _database = None


def get_database() -> AsyncIOMotorDatabase | MirroredDatabase:
    """Return the initialized database or raise a clear lifecycle error."""
    if _database is None:
        raise RuntimeError("MongoDB is not initialized; start the application first.")
    return _database
