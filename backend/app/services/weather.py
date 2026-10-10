"""Small Open-Meteo client; endpoints are fixed and requests have a timeout."""
import asyncio
import json
import math
from urllib.parse import urlencode
from urllib.request import Request, urlopen


async def provider_json(endpoint: str, parameters: dict) -> dict:
    def read() -> dict:
        request = Request(f"{endpoint}?{urlencode(parameters)}", headers={"User-Agent": "ThreadWardrobe/1.0"})
        with urlopen(request, timeout=8) as response:
            result = json.loads(response.read(1_000_000))
        if not isinstance(result, dict) or result.get("error"):
            raise ValueError("Unexpected weather response")
        return result
    return await asyncio.to_thread(read)


def weather_condition(temperature: float, code: int, wind: float) -> str:
    if 51 <= code <= 67 or 80 <= code <= 82 or 95 <= code <= 99:
        return "rainy"
    if temperature <= 10 or 71 <= code <= 77 or 85 <= code <= 86:
        return "cold"
    if wind >= 25:
        return "windy"
    return "sunny" if code in {0, 1} else "cloudy"


async def locations(query: str) -> list[dict]:
    data = await provider_json("https://geocoding-api.open-meteo.com/v1/search", {"name": query, "count": 5, "language": "en", "format": "json"})
    return [{"id": entry["id"], "name": ", ".join(dict.fromkeys(str(entry[key]) for key in ("name", "admin1", "country") if entry.get(key))), "latitude": entry["latitude"], "longitude": entry["longitude"]} for entry in data.get("results", [])]


async def current_weather(latitude: float, longitude: float) -> dict:
    data = await provider_json("https://api.open-meteo.com/v1/forecast", {"latitude": latitude, "longitude": longitude, "current": "temperature_2m,weather_code,wind_speed_10m", "timezone": "auto"})
    current = data["current"]
    temperature = float(current["temperature_2m"])
    if not math.isfinite(temperature) or not -30 <= temperature <= 60:
        raise ValueError("Weather temperature outside supported range")
    return {"temperature_c": temperature, "condition": weather_condition(temperature, int(current["weather_code"]), float(current["wind_speed_10m"])), "observed_at": current["time"], "timezone": data["timezone"], "source": "Open-Meteo"}
