# Thread — Smart Wardrobe

A responsive wardrobe and outfit-planning MVP built with Next.js, React, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Register and sign in with a private session cookie.
- Upload clothing photos, get a category suggestion, and review detected colors and attributes.
- Filter and search your wardrobe by category, type, color, season, occasion, and date.
- Generate outfit combinations using your wardrobe, preferences, occasion, and manually entered weather.
- Customize, save, rename, favorite, and delete looks stored in MongoDB.
- Request Gemini styling advice, with local fallback suggestions when unavailable.

Run `npm run build` for a production build and `npm run typecheck` for TypeScript validation.

## Scope

The frontend uses the FastAPI service in `../backend` for authentication,
preferences, wardrobe CRUD, classification, attribute extraction, outfit
recommendations, styling advice, and saved outfits. Metadata is stored in
MongoDB; clothing photos are served by protected backend image endpoints.
Weather is entered manually. The classifier requires trained weights under
`../ml/artifacts/`; category selection remains available if inference fails.

Requests use `/api` on the frontend origin. Next.js forwards them to FastAPI
at `http://127.0.0.1:8000`, preserving session cookies and private images.
Copy `.env.example` to `.env.local` to change `WARDROBE_API_ORIGIN`.
From the repository root, `./start-dev.ps1` starts the local Windows stack.
Alternatively, run the FastAPI
backend and MongoDB as described in the repository root README before creating
an account or saving preferences.
