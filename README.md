# GO Train Expo App (Frontend MVP)

This project is an Expo Router app focused on fast, route-first GO train trip planning.

## Why static GTFS in Expo

GTFS source files in `GO-GTFS/` are large (`stop_times.txt` alone is tens of MB).  
Parsing those files inside a mobile app causes slow startup, high memory usage, and poor UX.

This app uses a build-time transformer:

- Reads GTFS text files once on your machine.
- Keeps only train routes (`route_type=2`) and only fields needed by the frontend.
- Outputs a compact static snapshot at `data/go-train-static.json`.
- App runtime loads that JSON directly (no CSV parsing on-device).

## Setup

1. Install deps:

```bash
npm install
```

2. Build static schedule snapshot:

```bash
npm run build:gtfs
```

Optional: build for a specific GTFS service date:

```bash
npm run build:gtfs -- --serviceDate=20260323
```

3. Start Expo:

```bash
npm start
```

## App structure

- `app/(tabs)/index.tsx`: Main planner screen (bottom search pill, animated line/start/destination sheet, favourite journey action, upcoming trip times).
- `scripts/build-gtfs-static.js`: GTFS transformer script.
- `data/go-train-static.json`: Generated static schedule snapshot.
- `lib/go-train-data.ts`: Typed selectors/helpers for route/stop filtering and route segment times.
- `types/go-train.ts`: Data contracts shared by script and UI.

## Frontend-first best practices used here

- Build-time data transformation (heavy work done before app launch).
- Typed static data contract (`types/go-train.ts`) to avoid runtime shape drift.
- Dynamic route and stop filtering with constrained suggestions.
- Smooth bottom-sheet selection flow with a custom bottom search pill.
- Favourite journey persisted locally with line, start station, and destination.
- Friendly 12-hour time display (AM/PM).
- Minimal screen responsibilities with utility helpers moved to `lib/`.
