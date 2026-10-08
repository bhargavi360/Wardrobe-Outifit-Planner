"""Tests for Gemini styling prompts, retries, cache, and fallback behavior."""

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import SecretStr

from app.services import gemini_styling

ITEMS = [
    {
        "id": "top-1",
        "name": "Navy linen shirt",
        "category": "top",
        "dominant_colors": ["navy"],
        "sub_type": "shirt",
    }
]
WEATHER = {"temperature_c": 22, "condition": "sunny"}


@pytest.fixture(autouse=True)
def clear_styling_cache() -> None:
    gemini_styling._CACHE.clear()


def test_parse_gemini_response_requires_all_sections() -> None:
    parsed = gemini_styling._parse_gemini_response(
        "Styling tip: Roll the sleeves once.\n"
        "Accessory suggestions: Watch, Tote bag\n"
        "Why it works: The relaxed details suit the occasion."
    )
    assert parsed == {
        "styling_tip": "Roll the sleeves once.",
        "accessory_suggestions": ["Watch", "Tote bag"],
        "why_it_works": "The relaxed details suit the occasion.",
        "source": "gemini",
    }
    with pytest.raises(ValueError, match="omitted"):
        gemini_styling._parse_gemini_response("A response without labels")


def test_prompt_includes_outfit_weather_and_preferences() -> None:
    prompt = gemini_styling._build_prompt(
        ITEMS,
        "formal",
        {"temperature_c": 10, "condition": "rainy"},
        {"favorite_colors": ["navy"], "disliked_colors": ["orange"]},
    )
    assert "Occasion: formal" in prompt
    assert "rainy / 10 C" in prompt
    assert "Navy linen shirt" in prompt
    assert "favorite colors=navy" in prompt
    assert "disliked colors=orange" in prompt


def test_sdk_call_uses_configured_model_timeout_and_closes_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, *, api_key: str, http_options: Any) -> None:
            calls["api_key"] = api_key
            calls["timeout"] = http_options.timeout
            self.models = self

        def generate_content(self, *, model: str, contents: str) -> Any:
            calls["model"] = model
            calls["prompt"] = contents
            return SimpleNamespace(
                text=(
                    "Styling tip: Keep the lines clean.\n"
                    "Accessory suggestions: Watch, Belt\n"
                    "Why it works: The palette feels focused."
                )
            )

        def close(self) -> None:
            calls["closed"] = True

    fake_sdk = SimpleNamespace(
        Client=FakeClient,
        types=SimpleNamespace(
            HttpOptions=lambda **kwargs: SimpleNamespace(**kwargs)
        ),
    )
    monkeypatch.setattr(gemini_styling, "genai", fake_sdk)
    monkeypatch.setattr(
        gemini_styling.settings,
        "gemini_api_key",
        SecretStr("test-api-key"),
    )
    monkeypatch.setattr(gemini_styling.settings, "gemini_model", "test-model")

    result = gemini_styling._call_gemini("style prompt")

    assert result["source"] == "gemini"
    assert calls["api_key"] == "test-api-key"
    assert calls["model"] == "test-model"
    assert calls["timeout"] == 15_000
    assert calls["prompt"] == "style prompt"
    assert calls["closed"] is True


def test_generated_result_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0
    response = {
        "styling_tip": "Keep the line clean.",
        "accessory_suggestions": ["Watch", "Belt"],
        "why_it_works": "The proportions feel balanced.",
        "source": "gemini",
    }

    def fake_call(_: str) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return response

    monkeypatch.setattr(gemini_styling, "_call_gemini", fake_call)
    first = asyncio.run(
        gemini_styling.get_cached_or_generate(ITEMS, "formal", WEATHER)
    )
    second = asyncio.run(
        gemini_styling.get_cached_or_generate(ITEMS, "formal", WEATHER)
    )

    assert first == second == response
    assert calls == 1
    assert first is not response


def test_generation_retries_then_returns_gemini_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0
    delays: list[float] = []

    def fake_call(_: str) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        if calls < 2:
            raise RuntimeError("temporary provider failure")
        return {
            "styling_tip": "Keep it simple.",
            "accessory_suggestions": ["Watch", "Belt"],
            "why_it_works": "The palette stays focused.",
            "source": "gemini",
        }

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)

    monkeypatch.setattr(gemini_styling, "_call_gemini", fake_call)
    monkeypatch.setattr(gemini_styling.asyncio, "sleep", fake_sleep)
    result = asyncio.run(
        gemini_styling.get_cached_or_generate(ITEMS, "casual", WEATHER)
    )

    assert calls == 2
    assert delays == [0.25]
    assert result["source"] == "gemini"


def test_exhausted_retries_return_short_lived_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0
    now = 1000.0

    def fake_call(_: str) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        raise RuntimeError("provider unavailable")

    async def fake_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(gemini_styling, "_call_gemini", fake_call)
    monkeypatch.setattr(gemini_styling.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(gemini_styling, "_now_seconds", lambda: now)

    result = asyncio.run(
        gemini_styling.get_cached_or_generate(ITEMS, "casual", WEATHER)
    )
    assert result["source"] == "fallback"
    assert calls == gemini_styling._MAX_RETRIES

    cached = asyncio.run(
        gemini_styling.get_cached_or_generate(ITEMS, "casual", WEATHER)
    )
    assert cached == result
    assert calls == gemini_styling._MAX_RETRIES

    now += gemini_styling._FALLBACK_CACHE_TTL_SECONDS + 1
    asyncio.run(gemini_styling.get_cached_or_generate(ITEMS, "casual", WEATHER))
    assert calls == gemini_styling._MAX_RETRIES * 2
