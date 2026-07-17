"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Quote, SessionInfo } from "@/lib/types";

interface QuotesPayload {
  quotes: Quote[];
  session: SessionInfo;
  time: number;
}

/**
 * Live quotes via HTTP polling (Vercel-compatible, no WebSocket needed).
 * Polls every 2 seconds. Falls back gracefully on errors.
 */
export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [session, setSession] = useState<SessionInfo>({ name: "Connecting", vol: 1 });
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPayload = useCallback((data: QuotesPayload) => {
    const map: Record<string, Quote> = {};
    for (const q of data.quotes) map[q.symbol] = q;
    setQuotes(map);
    setSession(data.session);
    setLastUpdate(data.time);
    setConnected(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/market/quotes");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        applyPayload(data);
      } catch {
        if (!cancelled) setConnected(false);
      }
    };

    // Initial fetch
    poll();

    // Poll every 2 seconds
    pollRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [applyPayload]);

  return { quotes, session, connected, lastUpdate };
}
