"""Planning rules: deduplication, date validation, ownership, and packing scope."""
import asyncio
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError
import pytest
from app.routers import planning
from app.schemas.planning import TripInput, PackingInput


def test_shared_packing_pieces_are_counted_once_with_all_looks():
    outfits = [
        {"name": "Morning", "items": [{"item_id": "shirt", "name": "Shirt", "category": "top"}, {"item_id": "shoes", "name": "Shoes", "category": "footwear"}]},
        {"name": "Evening", "items": [{"item_id": "shirt", "name": "Shirt", "category": "top"}]},
    ]
    result = planning.packing_items(outfits)
    assert len(result) == 2
    assert next(item for item in result if item["item_id"] == "shirt")["outfit_names"] == ["Morning", "Evening"]


def test_trip_dates_and_empty_outfits_are_validated():
    payload = {"name": " Trip ", "start_date": "2026-10-10", "end_date": "2026-10-11", "outfit_ids": ["a", "a"]}
    trip = TripInput.model_validate(payload)
    assert trip.name == "Trip"
    assert trip.outfit_ids == ["a"]
    for updates in ({"end_date": "2026-10-09"}, {"outfit_ids": []}, {"name": "   "}):
        with pytest.raises(ValidationError):
            TripInput.model_validate({**payload, **updates})


def test_packing_cannot_update_another_users_trip_or_an_unlisted_piece(monkeypatch):
    class Collection:
        query = None
        async def find_one_and_update(self, query, update, **kwargs):
            self.query = query
            return None
    collection = Collection()
    monkeypatch.setattr(planning, "get_database", lambda: {"trips": collection})
    trip_id = str(ObjectId())
    with pytest.raises(HTTPException) as error:
        asyncio.run(planning.pack(trip_id, PackingInput(item_id="foreign-piece", packed=True), {"_id": "user-1"}))
    assert error.value.status_code == 404
    assert collection.query == {"_id": ObjectId(trip_id), "user_id": "user-1", "items.item_id": "foreign-piece"}


def test_schedule_rejects_outfits_outside_the_owned_collection(monkeypatch):
    class Cursor:
        async def to_list(self, **kwargs): return []
    class Collection:
        query = None
        def find(self, query): self.query = query; return Cursor()
    collection = Collection()
    monkeypatch.setattr(planning, "get_database", lambda: {"outfits": collection})
    with pytest.raises(HTTPException) as error:
        asyncio.run(planning.owned_outfits("user-1", [str(ObjectId())]))
    assert error.value.status_code == 404
    assert collection.query["user_id"] == "user-1"
