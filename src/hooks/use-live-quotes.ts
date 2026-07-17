"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { Quote, SessionInfo } from "@/lib/types";

interface QuotesPayload {
  quotes: Quote[];
  session: SessionInfo;
  time: number;
}

/**
 * Live quotes via WebSocket (port 3003, path "/", XTransformPort=3003).
 * Falls back to HTTP polling if the socket cannot connect.
 */
export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [session, setSession] = useState<SessionInfo>({ name: "Connecting", vol: 1 });
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPayload = useCallback((data: QuotesPayload) => {
    const map: Record<string, Quote> = {};
    for (const q of data.quotes) map[q.symbol] = q;
    setQuotes(map);
    setSession(data.session);
    setLastUpdate(data.time);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/market/quotes?XTransformPort=3000");
        if (res.ok) {
          const data = await res.json();
          applyPayload(data);
        }
      } catch {
        // ignore
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  }, [applyPayload]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (cancelled) return;
      setConnected(true);
      stopPolling();
    });

    socket.on("disconnect", () => {
      if (cancelled) return;
      setConnected(false);
      startPolling();
    });

    socket.on("connect_error", () => {
      if (cancelled) return;
      setConnected(false);
      startPolling();
    });

    socket.on("quotes", (data: QuotesPayload) => {
      if (cancelled) return;
      applyPayload(data);
    });

    // Initial HTTP fetch so data shows immediately even before WS connects
    fetch("/api/market/quotes")
      .then((r) => r.json())
      .then(applyPayload)
      .catch(() => {});

    return () => {
      cancelled = true;
      socket.disconnect();
      stopPolling();
    };
  }, [applyPayload, startPolling, stopPolling]);

  return { quotes, session, connected, lastUpdate };
}
