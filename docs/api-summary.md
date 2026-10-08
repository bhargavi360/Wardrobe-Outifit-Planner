# API summary

## Authentication

- `POST /api/auth/register` — Register a user with email and password
- `POST /api/auth/login` — Sign in and establish the session cookie
- `POST /api/auth/logout` — Clear the current session
- `GET /api/auth/me` — Fetch current authenticated user details

## Preferences

- `GET /api/preferences` — Read user preferences
- `PUT /api/preferences` — Save or update preferences

## Wardrobe

- `GET /api/wardrobe` — List wardrobe items for the current user
- `POST /api/wardrobe` — Upload and save a new clothing item
- `GET /api/wardrobe/{item_id}` — Fetch one item
- `PATCH /api/wardrobe/{item_id}` — Update metadata
- `DELETE /api/wardrobe/{item_id}` — Remove an item
- `GET /api/wardrobe/{item_id}/image` — Fetch the stored image for an owned item

## Classification

- `POST /api/classify` — Upload an image and classify it into the wardrobe categories

## Outfit recommendation

- `POST /api/outfits/recommend` — Produce outfit suggestions for an occasion and weather context
- `POST /api/outfits/styling-tips` — Retrieve styling guidance from Gemini or fallback logic

## Saved outfits

- `GET /api/outfits` — List saved outfits
- `POST /api/outfits` — Save a new outfit
- `GET /api/outfits/{outfit_id}` — Fetch a specific saved outfit
- `PATCH /api/outfits/{outfit_id}` — Update name or metadata
- `DELETE /api/outfits/{outfit_id}` — Delete a saved outfit

## Health

- `GET /api/health` — Service health and database connectivity check
