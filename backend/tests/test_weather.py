import asyncio
import pytest
from app.services import weather
from app.routers import weather as route
from fastapi import HTTPException


@pytest.mark.parametrize("temperature,code,wind,expected", [(22, 0, 5, "sunny"), (22, 3, 5, "cloudy"), (22, 61, 30, "rainy"), (22, 95, 5, "rainy"), (5, 0, 5, "cold"), (15, 73, 5, "cold"), (22, 0, 30, "windy")])
def test_provider_weather_is_mapped_to_planner_conditions(temperature, code, wind, expected):
    assert weather.weather_condition(temperature, code, wind) == expected


def test_current_weather_preserves_temperature_and_observation_time(monkeypatch):
    async def provider(endpoint, parameters):
        assert endpoint == "https://api.open-meteo.com/v1/forecast"
        assert parameters["latitude"] == 17.3
        return {"timezone": "Asia/Kolkata", "current": {"temperature_2m": 28.5, "weather_code": 0, "wind_speed_10m": 10, "time": "2026-10-10T19:30"}}
    monkeypatch.setattr(weather, "provider_json", provider)
    result = asyncio.run(weather.current_weather(17.3, 78.4))
    assert result["temperature_c"] == 28.5
    assert result["observed_at"] == "2026-10-10T19:30"
    assert result["condition"] == "sunny"


def test_weather_outage_returns_actionable_manual_fallback(monkeypatch):
    async def unavailable(*args): raise OSError("network unavailable")
    monkeypatch.setattr(weather, "current_weather", unavailable)
    with pytest.raises(HTTPException) as error:
        asyncio.run(route.current({"_id": "user-1"}, latitude=17.3, longitude=78.4))
    assert error.value.status_code == 503
    assert "manually" in error.value.detail
