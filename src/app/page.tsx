"use client";

import { useState, useEffect } from "react";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useTerminalStore } from "@/lib/store";
import { getAllInstruments } from "@/lib/market/client";
import type { InstrumentDef, PairAnalysis, AnalysisSummary, Quote, Alert } from "@/lib/types";

import { TerminalHeader } from "@/components/terminal/terminal-header";
import { PriceTicker } from "@/components/terminal/price-ticker";
import { MarketOverview } from "@/components/terminal/market-overview";
import { MarketGrid } from "@/components/terminal/market-grid";
import { ChartPanel } from "@/components/terminal/chart-panel";
import { AnalysisPanel } from "@/components/terminal/analysis-panel";
import { AIChat } from "@/components/terminal/ai-chat";
import { NewsFeed } from "@/components/terminal/news-feed";
import { CalendarPanel } from "@/components/terminal/calendar-panel";
import { PositionsPanel } from "@/components/terminal/positions-panel";
import { DecisionsPanel } from "@/components/terminal/decisions-panel";
import { AlertsPanel } from "@/components/terminal/alerts-panel";
import { CorrelationPanel } from "@/components/terminal/correlation-panel";
import { BriefingPanel } from "@/components/terminal/briefing-panel";
import { SettingsDialog } from "@/components/terminal/settings-dialog";
import { OpenPositionDialog } from "@/components/terminal/open-position-dialog";

export default function TerminalPage() {
  const { quotes, session, connected } = useLiveQuotes();
  const { selectedSymbol, activeView, setSelectedSymbol, setActiveView } = useTerminalStore();

  const [instruments, setInstruments] = useState<InstrumentDef[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, PairAnalysis>>({});
  const [summaries, setSummaries] = useState<Record<string, AnalysisSummary>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [positionDialog, setPositionDialog] = useState<{
    open: boolean;
    data: any;
  }>({ open: false, data: null });
  const [positionsVersion, setPositionsVersion] = useState(0);

  // Load instruments once (client-side fetch via API)
  useEffect(() => {
    fetch("/api/market/instruments")
      .then((r) => r.json())
      .then((data) => setInstruments(data.instruments || []))
      .catch(() => {});
  }, []);

  // Load analysis periodically
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/analysis");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const aMap: Record<string, PairAnalysis> = {};
        const sMap: Record<string, AnalysisSummary> = {};
        for (const a of data.analysis || []) {
          aMap[a.symbol] = a;
        }
        for (const s of data.summaries || []) {
          sMap[s.symbol] = s;
        }
        setAnalysis(aMap);
        setSummaries(sMap);
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Load alerts count
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/alerts?limit=50");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAlerts(data.alerts || []);
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const unreadAlerts = alerts.filter((a) => !a.read).length;

  const selectedQuote: Quote | null = quotes[selectedSymbol] || null;
  const selectedAnalysis = analysis[selectedSymbol];
  const selectedSummary = summaries[selectedSymbol] || null;
  const selectedInstrument = instruments.find((i) => i.symbol === selectedSymbol);

  const handleOpenPosition = (data: any) => {
    setPositionDialog({ open: true, data });
  };

  const digits = selectedQuote?.digits || selectedInstrument?.digits || 5;

  return (
    <div className="min-h-screen flex flex-col bg-[#07090d] tt-grid-bg">
      <TerminalHeader
        session={session}
        connected={connected}
        unreadAlerts={unreadAlerts}
        onOpenAlerts={() => setAlertsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      <PriceTicker quotes={quotes} />

      <main className="flex-1 p-3 space-y-3 min-h-0 overflow-hidden">
        {/* Market overview always visible */}
        <MarketOverview quotes={quotes} analysis={analysis} />

        {activeView === "terminal" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            {/* Left: Market grid */}
            <div className="lg:col-span-3 min-h-0">
              <MarketGrid
                quotes={quotes}
                analysis={analysis}
                instruments={instruments.length ? instruments : (getAllInstruments() as InstrumentDef[])}
                selectedSymbol={selectedSymbol}
                onSelect={setSelectedSymbol}
              />
            </div>

            {/* Center: Chart + lower row */}
            <div className="lg:col-span-6 flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0">
                <ChartPanel
                  symbol={selectedSymbol}
                  quote={selectedQuote}
                  analysis={selectedAnalysis}
                  name={selectedInstrument?.name || ""}
                  category={selectedInstrument?.category || ""}
                />
              </div>
              <div className="h-[280px] min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                <PositionsPanel onRefresh={() => setPositionsVersion((v) => v + 1)} />
                <DecisionsPanel />
              </div>
            </div>

            {/* Right: Analysis + Chat */}
            <div className="lg:col-span-3 flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0">
                <AnalysisPanel
                  symbol={selectedSymbol}
                  analysis={selectedAnalysis}
                  summary={selectedSummary}
                  digits={digits}
                  onOpenPosition={handleOpenPosition}
                />
              </div>
              <div className="h-[360px] min-h-0">
                <AIChat />
              </div>
            </div>
          </div>
        )}

        {activeView === "analysis" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-4 min-h-0">
              <AnalysisPanel
                symbol={selectedSymbol}
                analysis={selectedAnalysis}
                summary={selectedSummary}
                digits={digits}
                onOpenPosition={handleOpenPosition}
              />
            </div>
            <div className="lg:col-span-4 min-h-0">
              <BriefingPanel />
            </div>
            <div className="lg:col-span-4 min-h-0">
              <CorrelationPanel />
            </div>
          </div>
        )}

        {activeView === "positions" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <PositionsPanel onRefresh={() => setPositionsVersion((v) => v + 1)} />
            <DecisionsPanel />
          </div>
        )}

        {activeView === "news" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <NewsFeed />
            <CalendarPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#0a0d12] px-4 py-2 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="tt-mono">AI Trading Terminal v1.0</span>
          <span className="hidden sm:inline">
            Engine:{" "}
            <span className={connected ? "tt-text-up" : "text-amber-400"}>
              {connected ? "Streaming" : "Polling"}
            </span>
          </span>
          <span className="hidden md:inline">
            Instruments: <span className="tt-mono text-slate-400">{Object.keys(quotes).length}</span>
          </span>
          <span className="hidden md:inline">
            Analysis: <span className="tt-mono text-slate-400">{Object.keys(analysis).length}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline tt-mono">
            Quant engine · GBM + session-aware volatility
          </span>
          <span className="tt-mono text-slate-600">
            © {new Date().getFullYear()}
          </span>
        </div>
      </footer>

      {/* Dialogs */}
      <AlertsPanel open={alertsOpen} onOpenChange={setAlertsOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OpenPositionDialog
        open={positionDialog.open}
        onOpenChange={(o) => setPositionDialog((p) => ({ ...p, open: o }))}
        data={positionDialog.data}
        digits={digits}
        onCreated={() => setPositionsVersion((v) => v + 1)}
      />
      {/* hidden ref to avoid unused warning */}
      <span className="hidden">{positionsVersion}</span>
    </div>
  );
}
