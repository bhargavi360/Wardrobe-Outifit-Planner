'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';

type Location = { id: number; name: string; latitude: number; longitude: number };
type Weather = { temperature_c: number; condition: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'cold'; observed_at: string; timezone: string };

export function WeatherPicker({ onApply, initialCity = '' }: { onApply: (weather: Weather) => void; initialCity?: string }) {
  const [query, setQuery] = useState(initialCity);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(''); setNotice(''); setLocations([]);
    try {
      const cities = await apiRequest<Location[]>(`/weather/locations?q=${encodeURIComponent(query.trim())}`, { signal: request.signal });
      if (request.signal.aborted) return;
      setLocations(cities); setLocationId(String(cities[0]?.id ?? ''));
      if (!cities.length) setError('No cities found. Try a nearby town, or enter weather manually.');
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'City search failed.'); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function loadWeather() {
    const location = locations.find(city => String(city.id) === locationId);
    if (!location) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(''); setNotice('');
    try {
      const weather = await apiRequest<Weather>(`/weather/current?latitude=${location.latitude}&longitude=${location.longitude}`, { signal: request.signal });
      if (request.signal.aborted) return;
      onApply(weather);
      setNotice(`${location.name} · ${weather.temperature_c}°C · ${weather.condition} · updated ${weather.observed_at.replace('T', ' ')} (${weather.timezone})`);
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Weather is unavailable. Use the manual controls.'); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  return <section className="weather-picker" aria-label="Automatic weather">
    <div><strong>Let the weather set the mood.</strong><p>Find your city to fill the temperature and conditions. You can still adjust them below.</p></div>
    <form onSubmit={search} className="weather-search">
      <label><span>City</span><input value={query} onChange={event => { setQuery(event.target.value); setLocations([]); setNotice(''); }} minLength={2} maxLength={80} required placeholder="e.g. Hyderabad" disabled={busy} /></label>
      <button type="submit" disabled={busy || query.trim().length < 2}>{busy ? 'Checking…' : 'Find city'}</button>
    </form>
    {locations.length > 0 && <div className="weather-search"><label><span>Choose location</span><select value={locationId} onChange={event => setLocationId(event.target.value)} disabled={busy}>{locations.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><button type="button" onClick={() => void loadWeather()} disabled={busy}>Use live weather</button></div>}
    {error && <p role="alert" className="thread-error">{error}</p>}
    {notice && <p role="status" className="weather-notice">{notice}</p>}
    <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="weather-credit">Weather by Open-Meteo</a>
  </section>;
}
