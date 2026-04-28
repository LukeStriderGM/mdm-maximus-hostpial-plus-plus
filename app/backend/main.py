import json
import logging
import os
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models.database import engine, Base
from services.nats_service import nats_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CORS_ORIGINS = json.loads(os.getenv("CORS_ORIGINS", '["http://localhost:5173","http://localhost:3000"]'))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Hospital++ backend...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")

    await nats_service.connect()

    yield

    # Shutdown
    await nats_service.disconnect()
    await engine.dispose()
    logger.info("Hospital++ backend stopped")


app = FastAPI(
    title="Hospital++",
    description="Medical logistics decision support — hub-and-spoke inventory datamesh",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from routers import hubs, spokes, inventory, analytics, ingestion, ws, supply_routes, ebm  # noqa: E402

app.include_router(hubs.router, prefix="/api/v1", tags=["hubs"])
app.include_router(spokes.router, prefix="/api/v1", tags=["spokes"])
app.include_router(inventory.router, prefix="/api/v1", tags=["inventory"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])
app.include_router(ingestion.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(supply_routes.router, prefix="/api/v1", tags=["supply-routes"])
app.include_router(ebm.router, prefix="/api/v1", tags=["ebm"])
app.include_router(ws.router, tags=["websocket"])


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "nats_connected": nats_service.connected}


# In production, serve the built frontend (Vite dist) from this same server.
# Resolves <repo>/app/frontend/dist; if missing (i.e. dev mode), this is a no-op.
FRONTEND_DIST = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # API and websocket routes are already registered above; FastAPI matches
        # those first. This handler only fires for non-matched paths.
        if full_path.startswith("api/") or full_path.startswith("ws"):
            raise HTTPException(status_code=404)
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(str(index))
        raise HTTPException(status_code=404)
    logger.info("Serving frontend from %s", FRONTEND_DIST)
else:
    logger.info("Frontend dist not found at %s — running API-only", FRONTEND_DIST)
