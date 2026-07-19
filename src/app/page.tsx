"use client";

import { useState, useEffect } from "react";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { useAutoSignalMonitor } from "@/hooks/use-auto-signal-monitor";
import { useTerminalStore } from "@/lib/store";
import { DEFAULT_INSTRUMENTS } from "@/lib/market/instruments";
import type { InstrumentDef, PairAnalysis, AnalysisSummary, Quote, Alert } from "@/lib/types";

import { TerminalHeader } from "@/components/terminal/terminal-header";
import { PriceTicker } from "@/components/terminal/price-ticker";
import { MarketOverview } from "@/components/terminal/market-overview";
import { MarketGrid } from "@/components/terminal/market-grid";
import { ChartPanel } from "@/components/terminal/chart-panel";
import { AnalysisPanel } from "@/components/terminal/analysis-panel";
import { NewsFeed } from "@/components/terminal/news-feed";
import { CalendarPanel } from "@/components/terminal/calendar-panel";
import { PositionsPanel } from "@/components/terminal/positions-panel";
import { DecisionsPanel } from "@/components/terminal/decisions-panel";
import { AlertsPanel } from "@/components/terminal/alerts-panel";
import { CorrelationPanel } from "@/components/terminal/correlation-panel";
import { BriefingPanel } from "@/components/terminal/briefing-panel";
import { SettingsDialog } from "@/components/terminal/settings-dialog";
import { OpenPositionDialog } from "@/components/terminal/open-position-dialog";
import { RefreshCw } from "lucide-react";

// V2 components
import { SmartMoneyPanel } from "@/components/terminal/v2/smart-money-panel";
import { PriceActionPanel } from "@/components/terminal/v2/price-action-panel";
import { MTFPanel } from "@/components/terminal/v2/mtf-panel";
import { ProbabilityWheel } from "@/components/terminal/v2/probability-wheel";
import { ScenariosPanel } from "@/components/terminal/v2/scenarios-panel";
import { HeatmapPanel } from "@/components/terminal/v2/heatmap-panel";
import { SessionAnalysisPanel } from "@/components/terminal/v2/session-analysis-panel";
import { CorrelationGraphPanel } from "@/components/terminal/v2/correlation-graph-panel";
import { DecisionTimelinePanel } from "@/components/terminal/v2/decision-timeline-panel";
import { TradeJournalPanel } from "@/components/terminal/v2/trade-journal-panel";
import { AIMemoryPanel } from "@/components/terminal/v2/ai-memory-panel";
import { ReanalyzeDialog } from "@/components/terminal/v2/reanalyze-dialog";

// V3 components
import { SignalPanel } from "@/components/terminal/v3/signal-panel";
import { ScannerPanel } from "@/components/terminal/v3/scanner-panel";
import { NotificationFeed } from "@/components/terminal/v3/notification-feed";
import { TradeMonitorPanel } from "@/components/terminal/v3/trade-monitor-panel";
import { SignalHistoryPanel } from "@/components/terminal/v3/signal-history-panel";
import { SignalDetailDialog } from "@/components/terminal/v3/signal-detail-dialog";

// V4 components
import { MultiAgentPanel } from "@/components/terminal/v4/multi-agent-panel";
import { AgentConsensusPanel } from "@/components/terminal/v4/agent-consensus-panel";

// V5 components
import { NewsIntelligencePanel } from "@/components/terminal/v5/news-intelligence-panel";
import { NewsSourcesPanel } from "@/components/terminal/v5/news-sources-panel";
import { ScheduledNewsPanel } from "@/components/terminal/v5/scheduled-news-panel";

// V6 components
import { AuditPanel } from "@/components/terminal/v6/audit-panel";
import { AuditDetailDialog } from "@/components/terminal/v6/audit-detail-dialog";
import { LatencyPanel } from "@/components/terminal/v6/latency-panel";
import { AIDecisionPanel } from "@/components/terminal/v6/ai-decision-panel";

function PanelFallback({ label }: { label: string }) {
  return (
    <div className="tt-panel rounded-xl h-full flex items-center justify-center text-xs text-slate-500">
      Loading {label}…
    </div>
  );
}

export default function TerminalPage() {
  const { quotes, session, connected } = useLiveQuotes();
  const { selectedSymbol, activeView, setSelectedSymbol, setActiveView } = useTerminalStore();

  // Sound notifications — plays sound for new signals, TP/SL hits, news changes
  useNotificationSound(true);
  // Auto signal monitor — scans market every 2min, monitors trade events every 15s
  useAutoSignalMonitor(true);

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
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
  const [probData, setProbData] = useState<{ buy: number; sell: number; wait: number } | null>(null);
  const [signalDetailId, setSignalDetailId] = useState<string | null>(null);
  const [signalDetailOpen, setSignalDetailOpen] = useState(false);
  const [auditDetailId, setAuditDetailId] = useState<string | null>(null);
  const [auditDetailOpen, setAuditDetailOpen] = useState(false);

  // Load instruments once (client-side fetch via API)
  useEffect(() => {
    fetch("/api/market/instruments")
      .then((r) => r.json())
      .then((data) => setInstruments(data.instruments || []))
      .catch(() => {});
  }, []);

  // Load analysis periodically (deferred 2s to reduce initial load burst)
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
    const initialTimer = setTimeout(load, 2000);
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
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

  // V3 AUTO-START WATCH MODE — runs automatically on launch, no button needed
  // 1. Market scanner: scans all pairs every 60s for new opportunities
  // 2. Trade monitor: monitors active signals every 15s for TP/SL/structure changes
  useEffect(() => {
    let scanCancelled = false;
    let monitorCancelled = false;

    // Initial scan after 5s (let other things load first)
    const scanInitial = setTimeout(async () => {
      try {
        await fetch("/api/scanner", { method: "POST" });
      } catch {
        // ignore
      }
    }, 5000);

    // Recurring scan every 60s
    const scanInterval = setInterval(async () => {
      if (scanCancelled) return;
      try {
        await fetch("/api/scanner", { method: "POST" });
      } catch {
        // ignore
      }
    }, 60000);

    // Trade monitor every 15s (starts after 10s)
    const monitorInitial = setTimeout(async () => {
      try {
        await fetch("/api/trade-events", { method: "POST" });
      } catch {
        // ignore
      }
    }, 10000);

    const monitorInterval = setInterval(async () => {
      if (monitorCancelled) return;
      try {
        await fetch("/api/trade-events", { method: "POST" });
      } catch {
        // ignore
      }
    }, 15000);

    return () => {
      scanCancelled = true;
      monitorCancelled = true;
      clearTimeout(scanInitial);
      clearTimeout(monitorInitial);
      clearInterval(scanInterval);
      clearInterval(monitorInterval);
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

  // Load probability for the selected symbol (V2) — only when MTF view is active
  useEffect(() => {
    if (activeView !== "mft") return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/probability/${selectedSymbol}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const p = data.probability;
        setProbData({ buy: p.buy, sell: p.sell, wait: p.wait });
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [selectedSymbol, activeView]);

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
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden min-w-0 overflow-hidden">
              <MarketGrid
                quotes={quotes}
                analysis={analysis}
                instruments={instruments.length ? instruments : (DEFAULT_INSTRUMENTS as InstrumentDef[])}
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
            </div>
          </div>
        )}

        {activeView === "audit" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-8 min-h-0 min-w-0 overflow-hidden">
              
                <AuditPanel onSelectAudit={(id) => { setAuditDetailId(id); setAuditDetailOpen(true); }} />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <LatencyPanel />
              
            </div>
          </div>
        )}

        {activeView === "newsintel" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-6 min-h-0 min-w-0 overflow-hidden">
              
                <NewsIntelligencePanel />
              
            </div>
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden">
              
                <ScheduledNewsPanel />
              
            </div>
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden">
              
                <NewsSourcesPanel />
              
            </div>
          </div>
        )}

        {activeView === "aidecision" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              <MarketGrid
                quotes={quotes}
                analysis={analysis}
                instruments={instruments.length ? instruments : (DEFAULT_INSTRUMENTS as InstrumentDef[])}
                selectedSymbol={selectedSymbol}
                onSelect={setSelectedSymbol}
              />
            </div>
            <div className="lg:col-span-8 min-h-0 min-w-0 overflow-hidden">
              
                <AIDecisionPanel symbol={selectedSymbol} />
              
            </div>
          </div>
        )}

        {activeView === "agents" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-7 min-h-0 min-w-0 overflow-hidden">
              
                <MultiAgentPanel symbol={selectedSymbol} />
              
            </div>
            <div className="lg:col-span-5 min-h-0 min-w-0 overflow-hidden">
              
                <AgentConsensusPanel onSelect={setSelectedSymbol} />
              
            </div>
          </div>
        )}

        {activeView === "analyst" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-5 min-h-0 min-w-0 overflow-hidden">
              
                <ScannerPanel />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <SignalPanel />
              
            </div>
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden">
              
                <NotificationFeed />
              
            </div>
          </div>
        )}

        {activeView === "signals" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            
              <SignalPanel />
            
            
              <SignalHistoryPanel onSelectSignal={(id) => { setSignalDetailId(id); setSignalDetailOpen(true); }} />
            
          </div>
        )}

        {activeView === "monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-8 min-h-0 min-w-0 overflow-hidden">
              
                <TradeMonitorPanel onSelectSignal={(id) => { setSignalDetailId(id); setSignalDetailOpen(true); }} />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <NotificationFeed />
              
            </div>
          </div>
        )}

        {activeView === "analysis" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              <AnalysisPanel
                symbol={selectedSymbol}
                analysis={selectedAnalysis}
                summary={selectedSummary}
                digits={digits}
                onOpenPosition={handleOpenPosition}
              />
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              <BriefingPanel />
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
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

        {activeView === "smartmoney" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <SmartMoneyPanel symbol={selectedSymbol} />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <PriceActionPanel symbol={selectedSymbol} />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden flex flex-col gap-3">
              <div className="min-h-0">
                
                  <ScenariosPanel symbol={selectedSymbol} />
                
              </div>
            </div>
          </div>
        )}

        {activeView === "mft" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-5 min-h-0 min-w-0 overflow-hidden">
              
                <MTFPanel symbol={selectedSymbol} />
              
            </div>
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden flex flex-col gap-3">
              <div className="flex items-center justify-center tt-panel rounded-xl p-4">
                {probData && <ProbabilityWheel buy={probData.buy} sell={probData.sell} wait={probData.wait} size={180} />}
              </div>
              <div className="min-h-0 flex-1">
                
                  <DecisionTimelinePanel symbol={selectedSymbol} />
                
              </div>
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <AIMemoryPanel symbol={selectedSymbol} />
              
            </div>
          </div>
        )}

        {activeView === "journal" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            
              <TradeJournalPanel />
            
            
              <DecisionTimelinePanel symbol={selectedSymbol} />
            
          </div>
        )}

        {activeView === "market" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="lg:col-span-5 min-h-0 min-w-0 overflow-hidden">
              
                <HeatmapPanel />
              
            </div>
            <div className="lg:col-span-4 min-h-0 min-w-0 overflow-hidden">
              
                <CorrelationGraphPanel />
              
            </div>
            <div className="lg:col-span-3 min-h-0 min-w-0 overflow-hidden">
              
                <SessionAnalysisPanel />
              
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#0a0d12] px-4 py-2 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="tt-mono">AI Trading Terminal v2.0</span>
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

      {/* ReAnalyze button (floating, bottom-left of main area) */}
      <button
        onClick={() => setReanalyzeOpen(true)}
        className="fixed bottom-12 right-4 z-30 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-lg shadow-emerald-600/30 transition-colors"
        title="Re-analyze and compare before/after"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        ReAnalyze
      </button>

      {/* Dialogs — only render when open to avoid hydration issues */}
      <AlertsPanel open={alertsOpen} onOpenChange={setAlertsOpen} />
      {reanalyzeOpen && (
        
          <ReanalyzeDialog open={reanalyzeOpen} onOpenChange={setReanalyzeOpen} symbol={selectedSymbol} />
        
      )}
      {signalDetailOpen && (
        
          <SignalDetailDialog open={signalDetailOpen} onOpenChange={setSignalDetailOpen} signalId={signalDetailId} />
        
      )}
      {auditDetailOpen && (
        
          <AuditDetailDialog open={auditDetailOpen} onOpenChange={setAuditDetailOpen} auditId={auditDetailId} />
        
      )}
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
