"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";

type Handler = (...args: unknown[]) => void;

export interface SocketApi {
  connected: boolean;
  /** Emit an event to the server. No-op if not connected. */
  emit: (event: string, ...args: unknown[]) => void;
  /** Subscribe to an event. Returns an unsubscribe function. */
  on: (event: string, handler: Handler) => () => void;
  /** Join a realtime room (e.g. `order:<id>`). */
  join: (room: string) => void;
  /** Leave a room. */
  leave: (room: string) => void;
}

/**
 * useSocket — connects to the YukTaxi realtime mini-service (port 3003).
 * Connection path is always "/" with XTransformPort=3003 per the gateway rules.
 *
 * Returns a stable SocketApi (methods read the underlying socket via ref inside
 * callbacks/effects — never during render), plus a reactive `connected` flag.
 */
export function useSocket(autoConnect = true): SocketApi {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;
    const instance = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
      timeout: 10000,
    });
    socketRef.current = instance;
    return () => {
      instance.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect]);

  const connected = useSyncExternalStore(
    (onChange) => {
      const s = socketRef.current;
      if (!s) return () => {};
      const onC = () => onChange();
      const onD = () => onChange();
      s.on("connect", onC);
      s.on("disconnect", onD);
      return () => {
        s.off("connect", onC);
        s.off("disconnect", onD);
      };
    },
    () => socketRef.current?.connected ?? false,
    () => false
  );

  return useMemo<SocketApi>(
    () => ({
      connected,
      emit: (event, ...args) => socketRef.current?.emit(event, ...args),
      on: (event, handler) => {
        const s = socketRef.current;
        if (s) s.on(event, handler);
        return () => s?.off(event, handler);
      },
      join: (room) => socketRef.current?.emit("join", { room }),
      leave: (room) => socketRef.current?.emit("leave", { room }),
    }),
    [connected]
  );
}
