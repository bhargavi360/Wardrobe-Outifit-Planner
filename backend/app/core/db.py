"""MongoDB client lifecycle and collection initialization."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.models.collections import COLLECTION_NAMES

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    """Connect to MongoDB and ensure the application collections exist."""
    global _client, _database

    if _client is not None:
        return

    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
    )
    try:
        await client.admin.command("ping")
        database = client[settings.mongodb_database]
        existing_collections = set(await database.list_collection_names())
        for collection_name in COLLECTION_NAMES:
            if collection_name not in existing_collections:
                await database.create_collection(collection_name)
        await database["users"].create_index("email", unique=True)
        await database["clothing_items"].create_index(
            [("user_id", 1), ("created_at", -1)]
        )
        await database["outfit_calendar"].create_index([("user_id", 1), ("date", 1)], unique=True)
        await database["trips"].create_index([("user_id", 1), ("start_date", -1)])
    except PyMongoError:
        client.close()
        raise

    _client = client
    _database = database


async def close_mongo_connection() -> None:
    """Close the MongoDB client during application shutdown."""
    global _client, _database

    if _client is not None:
        _client.close()
    _client = None
    _database = None


def get_database() -> AsyncIOMotorDatabase:
    """Return the initialized database or raise a clear lifecycle error."""
    if _database is None:
        raise RuntimeError("MongoDB is not initialized; start the application first.")
    return _database
