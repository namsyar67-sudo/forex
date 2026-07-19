"use client";

import { useEffect, useRef } from "react";
import {
  playSignalSound,
  playTPHitSound,
  playSLHitSound,
  playNewsAlertSound,
  playBreakingNewsSound,
  playTradeUpdateSound,
  playCloseTradeSound,
} from "./use-sound";

interface TradeEvent {
  id: string;
  type: string;
  symbol: string;
  title: string;
  priority: string;
  createdAt: string;
}

/**
 * Monitors trade events (notifications) and plays sound alerts.
 * Polls /api/notifications every 10 seconds for new events.
 * Tracks last seen event ID to only play sound for NEW events.
 */
export function useNotificationSound(enabled: boolean = true) {
  const lastEventId = useRef<string | null>(null);
  const lastEventTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/notifications?limit=5");
        if (!res.ok) return;
        const data = await res.json();
        const events: TradeEvent[] = data.events || [];

        if (events.length === 0) return;

        // On first load, just record the latest event ID (don't play sound for old events)
        if (!lastEventId.current) {
          lastEventId.current = events[0].id;
          lastEventTime.current = new Date(events[0].createdAt).getTime();
          return;
        }

        // Check for new events (newer than last seen)
        const newEvents = events.filter(
          (e) => !lastEventId.current || new Date(e.createdAt).getTime() > lastEventTime.current
        );

        if (newEvents.length === 0) return;

        // Update last seen
        lastEventId.current = newEvents[0].id;
        lastEventTime.current = new Date(newEvents[0].createdAt).getTime();

        // Play sound based on event type (play for the most recent new event)
        const latest = newEvents[0];
        playSoundForEvent(latest.type);
      } catch {
        // ignore
      }
    };

    // Initial poll after 10 seconds (let page load first)
    const initialTimer = setTimeout(poll, 10000);

    // Poll every 10 seconds
    const interval = setInterval(poll, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabled]);
}

function playSoundForEvent(type: string) {
  switch (type) {
    case "NEW_SIGNAL":
      playSignalSound();
      break;
    case "TAKE_PROFIT_HIT":
      playTPHitSound();
      break;
    case "CLOSE_POSITION":
      playCloseTradeSound();
      break;
    case "HIGH_IMPACT_NEWS":
      playNewsAlertSound();
      break;
    case "BREAKING_NEWS":
      playBreakingNewsSound();
      break;
    case "BOS_DETECTED":
    case "CHOCH_DETECTED":
    case "OB_BROKEN":
    case "TREND_CHANGE":
    case "CONFIDENCE_CHANGED":
    case "RISK_ELEVATED":
    case "VOLATILITY_ALERT":
    case "LIQUIDITY_ALERT":
      playTradeUpdateSound();
      break;
    default:
      // Check if it's a loss (title contains LOSS)
      playTradeUpdateSound();
  }
}
