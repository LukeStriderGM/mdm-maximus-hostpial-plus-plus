# Hospital++

Medical logistics decision support — a hub-and-spoke inventory datamesh that
visualizes risk across a network of medical hubs and spokes, predicts
stockouts, and surfaces explainable ML risk scores.

## Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy async + asyncpg, scikit-learn /
  Interpret EBM model, optional NATS JetStream for event mesh.
- **Frontend:** React 19 + Vite 8 + TypeScript, Tailwind v4, MapLibre GL,
  TanStack Query, React Router v7, uPlot.
- **Database:** PostgreSQL (Replit-managed; `DATABASE_URL` env var).
- **Optional:** NATS for real-time events. Disabled in Replit by default;
  enable by setting `NATS_URL` to a reachable NATS server.

## Project Layout

```
app/
  backend/         FastAPI app, routers, models, services, seed.py
  frontend/        Vite + React app (src/pages, src/components, src/lib)
data/              Sample inventory CSV / Excel reference data
ml/                Standalone ML training scripts (not required at runtime)
ml_models/         EBM model + companion training scripts
```

## How It Runs in Replit

A single **`Start application`** workflow runs both servers together:

```
cd app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &
cd app/frontend && exec npm run dev
```

- **Backend (FastAPI / uvicorn)** — `0.0.0.0:8000`
- **Frontend (Vite)** — `0.0.0.0:5000`, `allowedHosts: true` for the Replit
  iframe proxy. Webview output type.

The frontend dev server proxies:
- `/api` → `http://localhost:8000` (REST)
- `/ws/events` → `ws://localhost:8000` (WebSocket)

The frontend's API base URL defaults to the relative path `/api/v1`, and the
WebSocket URL is built from `window.location` so it works through the proxy
without any env vars.

## Database

`DATABASE_URL` is provisioned automatically by Replit. `app/backend/models/database.py`
normalizes the URL (adds `+asyncpg` driver, strips `sslmode`) so SQLAlchemy's
async engine can use it directly. Tables are created on startup.

To seed the database with sample hubs/spokes/inventory/events:
```
cd app/backend && python seed.py --hubs 5 --spokes 20
```

## Deployment

Configured as a **VM** deployment that builds the frontend and serves both API
and static UI from a single FastAPI process on port 5000.

- Build: `cd app/frontend && npm install && npm run build`
- Run:   `cd app/backend && uvicorn main:app --host 0.0.0.0 --port 5000`

`app/backend/main.py` mounts `app/frontend/dist` and serves it as an SPA when
the dist folder exists (production), while still namespacing the API under
`/api/v1` and the WebSocket under `/ws`.

## Notes / Replit-Specific Adjustments

- NATS is disabled by default (`NATS_URL` empty). The backend logs a notice
  and continues without real-time events.
- Vite is bound to `0.0.0.0:5000` with all hosts allowed so Replit's preview
  proxy can reach it through the iframe.
- The backend binds to `0.0.0.0:8000` in dev so the workflow port detector
  recognizes it; the frontend Vite proxy still reaches it via `localhost`.
