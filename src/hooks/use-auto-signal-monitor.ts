"use client";

import { useEffect, useRef } from "react";
import { playSignalSound, playBreakingNewsSound } from "./use-sound";

/**
 * Auto Signal Monitor
 * Scans all pairs every 2 minutes for high-quality opportunities.
 * When a new high-confidence signal is found (quality >= 80), plays a sound
 * and the notification appears in the Notifications feed automatically.
 *
 * Also monitors active trades for news-impact changes and plays alert sounds.
 */
export function useAutoSignalMonitor(enabled: boolean = true) {
  const lastScanTime = useRef<number>(0);
  const lastSignalCount = useRef<number>(0);
  const lastTradeEventTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Run market scanner every 2 minutes (creates signals + notifications)
    const runScan = async () => {
      try {
        await fetch("/api/scanner", { method: "POST" });
        lastScanTime.current = Date.now();

        // Check for new signals after scan
        const sigRes = await fetch("/api/signals/active");
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          const currentCount = sigData.count || 0;

          // If new signals appeared, play sound
          if (currentCount > lastSignalCount.current && lastSignalCount.current > 0) {
            playSignalSound();
          }
          lastSignalCount.current = currentCount;
        }
      } catch {
        // ignore
      }
    };

    // Monitor trade events for news-impact changes
    const monitorTradeEvents = async () => {
      try {
        const res = await fetch("/api/notifications?limit=3");
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events || [];

        if (events.length === 0) return;

        // On first load, just record the latest event time
        if (lastTradeEventTime.current === 0) {
          lastTradeEventTime.current = new Date(events[0].createdAt).getTime();
          return;
        }

        // Check for new trade events (news-impact related)
        const newEvents = events.filter(
          (e: any) => new Date(e.createdAt).getTime() > lastTradeEventTime.current
        );

        if (newEvents.length > 0) {
          lastTradeEventTime.current = new Date(events[0].createdAt).getTime();

          // Play sound based on event type
          const latest = newEvents[0];
          switch (latest.type) {
            case "NEW_SIGNAL":
              playSignalSound();
              break;
            case "TAKE_PROFIT_HIT":
              playSignalSound();
              break;
            case "HIGH_IMPACT_NEWS":
            case "BREAKING_NEWS":
              playBreakingNewsSound();
              break;
            default:
              // Trade update (BOS, CHOCH, confidence change, etc.)
              if (latest.priority === "critical" || latest.priority === "high") {
                playBreakingNewsSound();
              }
          }
        }
      } catch {
        // ignore
      }
    };

    // Initial scan after 15 seconds (let page load)
    const scanTimer = setTimeout(runScan, 15000);
    const monitorTimer = setTimeout(monitorTradeEvents, 10000);

    // Recurring: scan every 2 minutes, monitor every 15 seconds
    const scanInterval = setInterval(runScan, 120000);
    const monitorInterval = setInterval(monitorTradeEvents, 15000);

    return () => {
      clearTimeout(scanTimer);
      clearTimeout(monitorTimer);
      clearInterval(scanInterval);
      clearInterval(monitorInterval);
    };
  }, [enabled]);
}
