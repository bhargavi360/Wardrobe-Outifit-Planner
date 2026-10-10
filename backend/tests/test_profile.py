"""Profile isolation, password changes, session invalidation, and safe exports."""
import asyncio
from datetime import UTC, datetime

import pytest
from bson import ObjectId
from fastapi import HTTPException, Response
from pydantic import ValidationError
from starlette.requests import Request

from app.core import auth as auth_dependency
from app.core.security import create_access_token, decode_access_token
from app.routers import auth, saved_outfits
from app.schemas.auth import PasswordChange, ProfileUpdate


def user():
    return {"_id": ObjectId(), "email": "qa@example.com", "password_hash": "private", "created_at": datetime.now(UTC), "city": "Hyderabad"}


def test_profile_update_is_partial_and_scoped_to_the_current_account(monkeypatch):
    account = user()
    class Collection:
        async def find_one_and_update(self, query, update, **kwargs):
            assert query == {"_id": account["_id"]}
            assert update == {"$set": {"display_name": "Bhargavi"}}
            return {**account, **update["$set"]}
    monkeypatch.setattr(auth, "get_database", lambda: {"users": Collection()})
    result = asyncio.run(auth.update_profile(ProfileUpdate(display_name=" Bhargavi "), account))
    assert result.display_name == "Bhargavi" and result.city == "Hyderabad"
    assert "password_hash" not in result.model_dump()


@pytest.mark.parametrize("payload", [{"display_name": "a" * 81}, {"bio": "a" * 501}, {"email": "other@example.com"}, {"city": None}])
def test_profile_input_rejects_invalid_or_noneditable_fields(payload):
    with pytest.raises(ValidationError): ProfileUpdate.model_validate(payload)


@pytest.mark.parametrize("current,new,status", [("wrongpass", "newpass123", 400), ("correct123", "correct123", 422)])
def test_password_change_failure_never_writes(monkeypatch, current, new, status):
    monkeypatch.setattr(auth, "verify_password", lambda password, _hash: password == "correct123")
    monkeypatch.setattr(auth, "get_database", lambda: pytest.fail("Password failure must not write"))
    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.change_password(PasswordChange(current_password=current, new_password=new), Response(), user()))
    assert error.value.status_code == status


def test_password_change_replaces_hash_increments_version_and_refreshes_cookie(monkeypatch):
    account = user()
    monkeypatch.setattr(auth, "verify_password", lambda *_: True)
    monkeypatch.setattr(auth, "hash_password", lambda *_: "new-private-hash")
    issued = []
    monkeypatch.setattr(auth, "_set_session_cookie", lambda response, uid, version: issued.append((uid, version)))
    class Collection:
        async def find_one_and_update(self, query, update, **kwargs):
            assert query == {"_id": account["_id"], "password_hash": "private"}
            assert update["$inc"] == {"session_version": 1}
            assert update["$set"]["password_hash"] == "new-private-hash"
            return {**account, "session_version": 1}
    monkeypatch.setattr(auth, "get_database", lambda: {"users": Collection()})
    response = asyncio.run(auth.change_password(PasswordChange(current_password="oldpass123", new_password="newpass123"), Response(), account))
    assert response.status_code == 204 and issued == [(str(account["_id"]), 1)]


@pytest.mark.parametrize("token_version,stored_version,accepted", [(None, 0, True), (0, 1, False), (1, 1, True)])
def test_old_sessions_are_rejected_after_password_change(monkeypatch, token_version, stored_version, accepted):
    account = {**user(), "session_version": stored_version}
    monkeypatch.setattr(auth_dependency, "decode_access_token", lambda *_: {"sub": str(account["_id"]), **({"version": token_version} if token_version is not None else {})})
    class Collection:
        async def find_one(self, query): return account
    monkeypatch.setattr(auth_dependency, "get_database", lambda: {"users": Collection()})
    request = Request({"type": "http", "headers": [(b"cookie", f"{auth_dependency.settings.auth_cookie_name}=test".encode())]})
    if accepted: assert asyncio.run(auth_dependency.get_current_user(request)) == account
    else:
        with pytest.raises(HTTPException) as error: asyncio.run(auth_dependency.get_current_user(request))
        assert error.value.status_code == 401


def test_session_version_is_signed_into_token():
    secret = "test-secret-with-more-than-thirty-two-characters"
    token = create_access_token("account", secret, 5, session_version=3)
    assert decode_access_token(token, secret)["version"] == 3


def test_export_filters_owners_and_excludes_private_storage_and_credentials(monkeypatch):
    account = user()
    class Cursor:
        async def to_list(self, **kwargs): return [{"_id": ObjectId(), "name": "Shirt", "password_hash": "private", "storage_path": "private/path", "session_version": 42}]
    class Collection:
        def __init__(self, name): self.name = name
        def find(self, query):
            assert query == ({"_id": str(account["_id"])} if self.name == "preferences" else {"user_id": str(account["_id"])})
            return Cursor()
    monkeypatch.setattr(auth, "get_database", lambda: {name: Collection(name) for name in ["clothing_items", "outfits", "preferences", "outfit_calendar", "trips"]})
    result = asyncio.run(auth.export_account(account))
    assert result["profile"]["email"] == account["email"]
    assert all(key not in str(result) for key in ["password_hash", "storage_path", "session_version"])


def test_saved_outfit_rejects_foreign_or_missing_pieces(monkeypatch):
    class Cursor:
        async def to_list(self, **kwargs): return []
    class Collection:
        def find(self, query):
            assert query["user_id"] == "owner"
            return Cursor()
    monkeypatch.setattr(saved_outfits, "get_database", lambda: {"clothing_items": Collection()})
    with pytest.raises(HTTPException) as error:
        asyncio.run(saved_outfits.owned_items("owner", [{"item_id": str(ObjectId())}]))
    assert error.value.status_code == 409


def test_saved_outfit_metadata_comes_from_owned_wardrobe(monkeypatch):
    piece_id = ObjectId()
    class Cursor:
        async def to_list(self, **kwargs): return [{"_id": piece_id, "name": "Real shirt", "category": "top", "dominant_colors": ["ivory"]}]
    class Collection:
        def find(self, query): return Cursor()
    monkeypatch.setattr(saved_outfits, "get_database", lambda: {"clothing_items": Collection()})
    result = asyncio.run(saved_outfits.owned_items("owner", [{"item_id": str(piece_id), "name": "Forged", "category": "dress"}]))
    assert result[0]["name"] == "Real shirt" and result[0]["category"] == "top"
    with pytest.raises(HTTPException) as error:
        asyncio.run(saved_outfits.owned_items("owner", [{"item_id": str(piece_id)}] * 2))
    assert error.value.status_code == 422
