import { useEffect, useRef, useState, useCallback } from "react";

interface WsEvent {
  type: string;
  subject?: string;
  data?: Record<string, unknown>;
  message?: string;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/events";

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          if (event.type !== "heartbeat") {
            setLastEvent(event);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
        retryRef.current++;
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    } catch {
      // Will retry via onclose
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, lastEvent };
}
