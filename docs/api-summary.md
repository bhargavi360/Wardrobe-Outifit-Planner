# API summary

## Authentication

- `POST /api/auth/register` — Register a user with email and password
- `POST /api/auth/login` — Sign in and establish the session cookie
- `POST /api/auth/logout` — Clear the current session
- `GET /api/auth/me` — Fetch current authenticated user details
- `PATCH /api/auth/me` — Update display name, city, or style bio; omitted fields remain unchanged.
- `POST /api/auth/password` — Verify `current_password`, set `new_password`, invalidate other sessions, and refresh this browser's session.
- `GET /api/auth/export` — Download account-owned profile and wardrobe metadata, preferences, saved outfits, calendar, and trips. Excludes password hashes, tokens, storage paths, and image files.

## Preferences

- `GET /api/preferences` — Read user preferences
- `PUT /api/preferences` — Save or update preferences

## Wardrobe

- `GET /api/wardrobe` — List wardrobe items for the current user
- `POST /api/wardrobe` — Upload and save a new clothing item
- `PATCH /api/wardrobe/{item_id}` — Update metadata
- `DELETE /api/wardrobe/{item_id}` — Remove an item
- `GET /api/wardrobe/{item_id}/image` — Fetch the stored image for an owned item

## Classification

- `POST /api/classify` — Upload an image and classify it into the wardrobe categories

## Outfit recommendation

- `POST /api/outfits/recommend` — Produce outfit suggestions for an occasion and weather context
  Optional `required_item_id` keeps an owned wardrobe piece in every suggestion. A missing or unowned piece returns `404`; an incomplete wardrobe returns an empty recommendation list.
- `POST /api/outfits/styling-tips` — Retrieve styling guidance from Gemini or fallback logic

## Planning and weather

- `GET /api/planning/calendar` — List account-owned calendar entries and wear history.
- `PUT /api/planning/calendar/{YYYY-MM-DD}` — Assign a saved outfit with `status: planned` or `worn`; replaces the day's entry without duplicating wear records.
- `DELETE /api/planning/calendar/{YYYY-MM-DD}` — Remove a calendar/wear entry.
- `GET`/`POST /api/planning/trips` — List or create trip packing lists from saved outfit IDs.
- `PUT`/`DELETE /api/planning/trips/{trip_id}` — Edit or remove a trip; edits retain packed items still in the checklist.
- `PATCH /api/planning/trips/{trip_id}/packing` — Set `{item_id, packed}` for a listed clothing piece.
- `GET /api/weather/locations?q=city` — Search cities through Open-Meteo.
- `GET /api/weather/current?latitude=...&longitude=...` — Return temperature, planner condition, and observation time. Provider failures return `503` with manual-entry guidance.
- `PATCH /api/wardrobe/{item_id}` also accepts `availability: available | laundry`; laundry items are excluded from outfit suggestions.

All of these endpoints require the signed-in session. Calendar/trip writes validate that both the saved outfits and their clothing pieces belong to that account.

## Saved outfits

- `GET /api/outfits` — List saved outfits
- `POST /api/outfits` — Save a new outfit
- `PATCH /api/outfits/{outfit_id}` — Update name or metadata
- Create and item updates validate ownership of each clothing piece and use its current wardrobe metadata. Missing or foreign pieces return `409`; repeated pieces return `422`.
- Outfit responses include creation/update timestamps for collection sorting. Existing calendar entries and trip lists keep their saved snapshots when an outfit is edited or deleted.
- `DELETE /api/outfits/{outfit_id}` — Delete a saved outfit

## Health

- `GET /api/health` — Service health and database connectivity check
