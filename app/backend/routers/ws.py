import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.nats_service import nats_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected")

    if not nats_service.connected:
        await websocket.send_json({"type": "info", "message": "NATS not connected, polling mode"})

    sub = None
    try:
        if nats_service.connected:
            try:
                sub = await nats_service.subscribe_events(None, "inventory.>")
            except Exception as e:
                logger.warning("Could not subscribe to NATS: %s. Falling back to heartbeat mode.", e)
                await websocket.send_json({"type": "info", "message": "NATS stream unavailable, heartbeat mode"})

        while True:
            if sub:
                try:
                    msg = await asyncio.wait_for(sub.next_msg(timeout=5), timeout=5)
                    event_data = {
                        "type": "inventory_event",
                        "subject": msg.subject,
                        "data": json.loads(msg.data.decode()),
                    }
                    await websocket.send_json(event_data)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "heartbeat"})
                except Exception as e:
                    logger.warning("NATS subscription error: %s", e)
                    await asyncio.sleep(1)
            else:
                await asyncio.sleep(5)
                await websocket.send_json({"type": "heartbeat"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        if sub:
            try:
                await sub.unsubscribe()
            except Exception:
                pass
