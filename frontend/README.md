# Thread — Smart Wardrobe

A responsive wardrobe and outfit-planning MVP built with Next.js, React, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Browse a sample closet and filter or search by clothing category, name, or color.
- Add pieces with an optional photo and manually selected category and color.
- Get outfit combinations based on closet contents, occasion, and selected weather.
- Save and remove favorite looks.
- Keep wardrobe items and saved looks in browser local storage.

Run `npm run build` for a production build and `npm run typecheck` for TypeScript validation.

## Scope

Login, registration, preferences, and wardrobe CRUD use the FastAPI service in
`../backend`. Wardrobe images are uploaded to the private backend storage
service; clothing classification, automatic attribute and color detection,
live weather, Gemini styling, and server-side saved outfit storage are planned
for later project phases. Recommendations use the selected closet attributes
and simple local rules; saved looks remain in per-account browser storage.

Copy `.env.example` to `.env.local` to change the backend URL. Run the FastAPI
backend and MongoDB as described in the repository root README before creating
an account or saving preferences.
