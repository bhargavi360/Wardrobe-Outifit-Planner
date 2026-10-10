"""Account-owned outfit calendar, wear records, and trip packing lists."""
from datetime import UTC, date, datetime
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pymongo import ReturnDocument

from app.core.auth import get_current_user
from app.core.db import get_database
from app.schemas.planning import CalendarInput, PackingInput, TripInput

router = APIRouter(prefix="/planning", tags=["planning"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "This record could not be found.")
    return ObjectId(value)


def public(document: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(document["_id"]), **{key: value for key, value in document.items() if key != "_id"}}


async def owned_outfits(user_id: str, ids: list[str]) -> list[dict[str, Any]]:
    database = get_database()
    documents = await database["outfits"].find({"user_id": user_id, "_id": {"$in": [object_id(value) for value in ids]}}).to_list(length=None)
    by_id = {str(document["_id"]): document for document in documents}
    if any(value not in by_id for value in ids):
        raise HTTPException(404, "One of these outfits is no longer in your collection.")
    items = {item["item_id"] for document in documents for item in document.get("items", [])}
    wardrobe = await database["clothing_items"].find({"user_id": user_id, "_id": {"$in": [object_id(value) for value in items]}}).to_list(length=None)
    if items - {str(item["_id"]) for item in wardrobe}:
        raise HTTPException(409, "An outfit contains removed wardrobe pieces. Update it in Saved Outfits first.")
    return [by_id[value] for value in ids]


def packing_items(outfits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for outfit in outfits:
        for item in outfit.get("items", []):
            item_id = item["item_id"]
            if item_id not in unique:
                unique[item_id] = {"item_id": item_id, "name": item["name"], "category": item["category"], "outfit_names": []}
            if outfit["name"] not in unique[item_id]["outfit_names"]:
                unique[item_id]["outfit_names"].append(outfit["name"])
    return sorted(unique.values(), key=lambda item: (item["category"], item["name"], item["item_id"]))


@router.get("/calendar")
async def calendar(current_user: CurrentUser) -> list[dict[str, Any]]:
    documents = await get_database()["outfit_calendar"].find({"user_id": str(current_user["_id"])}).sort("date", -1).to_list(length=None)
    return [public(document) for document in documents]


@router.put("/calendar/{day}")
async def schedule(day: date, payload: CalendarInput, current_user: CurrentUser) -> dict[str, Any]:
    user_id = str(current_user["_id"])
    outfit = (await owned_outfits(user_id, [payload.outfit_id]))[0]
    document = await get_database()["outfit_calendar"].find_one_and_update(
        {"user_id": user_id, "date": day.isoformat()},
        {"$set": {"outfit_id": payload.outfit_id, "name": outfit["name"], "items": outfit["items"], "status": payload.status, "updated_at": datetime.now(UTC)}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return public(document)


@router.delete("/calendar/{day}", status_code=204)
async def clear_day(day: date, current_user: CurrentUser) -> Response:
    await get_database()["outfit_calendar"].delete_one({"user_id": str(current_user["_id"]), "date": day.isoformat()})
    return Response(status_code=204)


@router.get("/trips")
async def trips(current_user: CurrentUser) -> list[dict[str, Any]]:
    documents = await get_database()["trips"].find({"user_id": str(current_user["_id"])}).sort("start_date", -1).to_list(length=None)
    return [public(document) for document in documents]


async def trip_fields(user_id: str, payload: TripInput) -> dict[str, Any]:
    outfits = await owned_outfits(user_id, payload.outfit_ids)
    return {**payload.model_dump(mode="json"), "items": packing_items(outfits), "outfit_names": [outfit["name"] for outfit in outfits], "updated_at": datetime.now(UTC)}


@router.post("/trips", status_code=201)
async def create_trip(payload: TripInput, current_user: CurrentUser) -> dict[str, Any]:
    user_id = str(current_user["_id"])
    document = {"_id": ObjectId(), "user_id": user_id, **await trip_fields(user_id, payload), "packed_item_ids": []}
    await get_database()["trips"].insert_one(document)
    return public(document)


@router.put("/trips/{trip_id}")
async def edit_trip(trip_id: str, payload: TripInput, current_user: CurrentUser) -> dict[str, Any]:
    user_id = str(current_user["_id"])
    collection = get_database()["trips"]
    query = {"_id": object_id(trip_id), "user_id": user_id}
    existing = await collection.find_one(query)
    if existing is None:
        raise HTTPException(404, "Trip not found.")
    fields = await trip_fields(user_id, payload)
    ids = {item["item_id"] for item in fields["items"]}
    fields["packed_item_ids"] = [value for value in existing.get("packed_item_ids", []) if value in ids]
    document = await collection.find_one_and_update(query, {"$set": fields}, return_document=ReturnDocument.AFTER)
    if document is None:
        raise HTTPException(404, "Trip not found.")
    return public(document)


@router.patch("/trips/{trip_id}/packing")
async def pack(trip_id: str, payload: PackingInput, current_user: CurrentUser) -> dict[str, Any]:
    collection = get_database()["trips"]
    query = {"_id": object_id(trip_id), "user_id": str(current_user["_id"]), "items.item_id": payload.item_id}
    operation = "$addToSet" if payload.packed else "$pull"
    document = await collection.find_one_and_update(query, {operation: {"packed_item_ids": payload.item_id}}, return_document=ReturnDocument.AFTER)
    if document is None:
        raise HTTPException(404, "This trip or packing item could not be found.")
    return public(document)


@router.delete("/trips/{trip_id}", status_code=204)
async def delete_trip(trip_id: str, current_user: CurrentUser) -> Response:
    result = await get_database()["trips"].delete_one({"_id": object_id(trip_id), "user_id": str(current_user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(404, "Trip not found.")
    return Response(status_code=204)
