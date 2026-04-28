import os
import json
import logging
from typing import Optional
import nats
from nats.js.api import StreamConfig, KeyValueConfig

logger = logging.getLogger(__name__)

NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")


class NatsService:
    """NATS JetStream service for the distributed mesh event bus."""

    def __init__(self):
        self._nc: Optional[nats.NATS] = None
        self._js = None
        self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected and self._nc is not None and self._nc.is_connected

    async def connect(self):
        try:
            self._nc = await nats.connect(
                NATS_URL,
                reconnect_time_wait=2,
                max_reconnect_attempts=10,
                error_cb=self._error_cb,
                disconnected_cb=self._disconnected_cb,
                reconnected_cb=self._reconnected_cb,
            )
            self._js = self._nc.jetstream()
            await self._setup_streams()
            await self._setup_kv()
            self._connected = True
            logger.info("Connected to NATS at %s", NATS_URL)
        except Exception as e:
            logger.warning("Could not connect to NATS: %s. Running without real-time events.", e)
            self._connected = False

    async def disconnect(self):
        if self._nc and self._nc.is_connected:
            await self._nc.drain()
            self._connected = False
            logger.info("Disconnected from NATS")

    async def _setup_streams(self):
        for stream_name, subjects in [
            ("INVENTORY_EVENTS", ["inventory.>"]),
            ("DEMAND_SIGNALS", ["demand.>"]),
            ("ALERTS", ["alerts.>"]),
        ]:
            try:
                await self._js.add_stream(
                    config=StreamConfig(
                        name=stream_name,
                        subjects=subjects,
                        max_msgs=100_000,
                        max_age=7 * 24 * 3600,  # 7 days in seconds
                    )
                )
                logger.info("Stream %s ready", stream_name)
            except Exception as e:
                if "already in use" in str(e).lower():
                    logger.debug("Stream %s already exists", stream_name)
                else:
                    logger.warning("Failed to create stream %s: %s", stream_name, e)

    async def _setup_kv(self):
        for bucket_name in ["node-status", "active-alerts", "system-config"]:
            try:
                await self._js.create_key_value(
                    config=KeyValueConfig(bucket=bucket_name, history=5, ttl=0)
                )
                logger.info("KV bucket %s ready", bucket_name)
            except Exception as e:
                if "already in use" in str(e).lower():
                    logger.debug("KV bucket %s already exists", bucket_name)
                else:
                    logger.warning("Failed to create KV bucket %s: %s", bucket_name, e)

    # --- Publishing ---

    async def publish_inventory_event(self, node_id: str, node_type: str, event_type: str, data: dict):
        if not self.connected:
            return
        subject = f"inventory.{node_type}.{node_id}.{event_type}"
        payload = json.dumps(data).encode()
        await self._js.publish(subject, payload)

    async def publish_demand_signal(self, spoke_id: str, data: dict):
        if not self.connected:
            return
        subject = f"demand.spoke.{spoke_id}"
        payload = json.dumps(data).encode()
        await self._js.publish(subject, payload)

    async def publish_alert(self, alert_data: dict):
        if not self.connected:
            return
        subject = f"alerts.{alert_data.get('severity', 'info')}"
        payload = json.dumps(alert_data).encode()
        await self._js.publish(subject, payload)

    # --- KV Operations ---

    async def set_node_status(self, node_id: str, status: dict):
        if not self.connected:
            return
        try:
            kv = await self._js.key_value("node-status")
            await kv.put(node_id, json.dumps(status).encode())
        except Exception as e:
            logger.warning("Failed to set node status: %s", e)

    async def get_node_status(self, node_id: str) -> Optional[dict]:
        if not self.connected:
            return None
        try:
            kv = await self._js.key_value("node-status")
            entry = await kv.get(node_id)
            return json.loads(entry.value.decode()) if entry.value else None
        except Exception:
            return None

    # --- Subscriptions ---

    async def subscribe_events(self, callback, subjects=None):
        if not self.connected:
            return None
        sub_subject = subjects or "inventory.>"
        sub = await self._js.subscribe(sub_subject, stream="INVENTORY_EVENTS", ordered_consumer=True)
        return sub

    # --- Callbacks ---

    async def _error_cb(self, e):
        logger.error("NATS error: %s", e)

    async def _disconnected_cb(self):
        self._connected = False
        logger.warning("Disconnected from NATS")

    async def _reconnected_cb(self):
        self._connected = True
        logger.info("Reconnected to NATS")


# Singleton instance
nats_service = NatsService()
