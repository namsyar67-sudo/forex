/**
 * Market Stream Service
 * Single source of truth for the market engine.
 *
 * - Port 3003: socket.io (path "/") for real-time push to the frontend
 * - Port 3004: REST API (HTTP) for Next.js server-side fetches
 *
 * Both share the SAME MarketEngine instance → no price divergence.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";

// ---------- Instruments ----------
interface InstrumentDef {
  symbol: string;
  name: string;
  category: string;
  basePrice: number;
  digits: number;
  pipSize: number;
  lotSize: number;
  spreadPips: number;
  volatility: number;
}

const DEFAULT_INSTRUMENTS: InstrumentDef[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex", basePrice: 1.0855, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.6, volatility: 0.07 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex", basePrice: 1.2715, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.8, volatility: 0.09 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex", basePrice: 151.42, digits: 3, pipSize: 0.01, lotSize: 100000, spreadPips: 0.7, volatility: 0.08 },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex", basePrice: 0.9035, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.9, volatility: 0.07 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex", basePrice: 0.6585, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.8, volatility: 0.10 },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex", basePrice: 0.6045, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 1.0, volatility: 0.11 },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex", basePrice: 1.3685, digits: 5, pipSize: 0.0001, lotSize: 100000, spreadPips: 0.9, volatility: 0.07 },
  { symbol: "XAUUSD", name: "Gold / US Dollar", category: "metals", basePrice: 2348.5, digits: 2, pipSize: 0.01, lotSize: 100, spreadPips: 25, volatility: 0.15 },
  { symbol: "XAGUSD", name: "Silver / US Dollar", category: "metals", basePrice: 27.85, digits: 3, pipSize: 0.001, lotSize: 5000, spreadPips: 30, volatility: 0.22 },
  { symbol: "BTCUSD", name: "Bitcoin / US Dollar", category: "crypto", basePrice: 67250, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 15, volatility: 0.65 },
  { symbol: "ETHUSD", name: "Ethereum / US Dollar", category: "crypto", basePrice: 3285, digits: 2, pipSize: 0.01, lotSize: 1, spreadPips: 20, volatility: 0.75 },
  { symbol: "NAS100", name: "US Tech 100 (Nasdaq)", category: "indices", basePrice: 18450, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 12, volatility: 0.20 },
  { symbol: "US30", name: "US 30 (Dow Jones)", category: "indices", basePrice: 39120, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 15, volatility: 0.16 },
  { symbol: "SPX500", name: "US 500 (S&P 500)", category: "indices", basePrice: 5235, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 10, volatility: 0.17 },
  { symbol: "GER40", name: "Germany 40 (DAX)", category: "indices", basePrice: 18150, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 12, volatility: 0.18 },
  { symbol: "UK100", name: "UK 100 (FTSE)", category: "indices", basePrice: 8185, digits: 1, pipSize: 0.1, lotSize: 1, spreadPips: 14, volatility: 0.15 },
];

// ---------- Engine ----------
interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface Quote {
  symbol: string; bid: number; ask: number; last: number; spread: number;
  changePct: number; changeAbs: number; high: number; low: number; open: number;
  time: number; digits: number;
}

const TIMEFRAMES: Record<string, number> = { m1: 60, m5: 300, m15: 900, h1: 3600, h4: 14400, d1: 86400 };
type Regime = "trend_up" | "trend_down" | "range" | "volatile";

interface SymbolState {
  instrument: InstrumentDef;
  price: number; sessionOpen: number; sessionHigh: number; sessionLow: number;
  regime: Regime; regimeStrength: number; momentum: number;
  candles: Record<string, Candle[]>; lastTickTime: number; rngState: number;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function getSessionMultiplier(hourUTC: number): { name: string; vol: number } {
  if (hourUTC >= 13 && hourUTC < 17) return { name: "London-NY Overlap", vol: 1.65 };
  if (hourUTC >= 8 && hourUTC < 13) return { name: "London", vol: 1.3 };
  if (hourUTC >= 17 && hourUTC < 22) return { name: "New York", vol: 1.2 };
  if (hourUTC >= 0 && hourUTC < 8) return { name: "Tokyo", vol: 0.8 };
  return { name: "Sydney", vol: 0.6 };
}
function pickRegime(rng: () => number, current: Regime): Regime {
  if (rng() < 0.85) return current;
  const roll = rng();
  if (roll < 0.4) return "trend_up";
  if (roll < 0.8) return "trend_down";
  if (roll < 0.95) return "range";
  return "volatile";
}

class MarketEngine {
  private states = new Map<string, SymbolState>();
  public readonly symbols: string[];
  private startEpoch: number;

  constructor() {
    this.startEpoch = Math.floor(Date.now() / 1000);
    this.symbols = DEFAULT_INSTRUMENTS.map((i) => i.symbol);
    for (const inst of DEFAULT_INSTRUMENTS) {
      const rng = mulberry32(inst.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
      const candles: Record<string, Candle[]> = {};
      for (const tf of Object.keys(TIMEFRAMES)) candles[tf] = [];
      this.states.set(inst.symbol, {
        instrument: inst, price: inst.basePrice, sessionOpen: inst.basePrice,
        sessionHigh: inst.basePrice, sessionLow: inst.basePrice,
        regime: pickRegime(rng, "range"), regimeStrength: 0.3 + rng() * 0.5,
        momentum: 0, candles, lastTickTime: this.startEpoch, rngState: inst.basePrice * 1000,
      });
    }
    this.warmup();
  }

  private rng(symbol: string): () => number {
    const st = this.states.get(symbol)!;
    return () => { st.rngState = (st.rngState * 1664525 + 1013904223) >>> 0; return st.rngState / 4294967296; };
  }

  private warmup() {
    const now = Math.floor(Date.now() / 1000);
    for (const symbol of this.symbols) {
      const st = this.states.get(symbol)!;
      const inst = st.instrument;
      const rng = this.rng(symbol);
      for (const tf of Object.keys(TIMEFRAMES)) {
        const tfSec = TIMEFRAMES[tf];
        const count = tf === "m1" ? 500 : tf === "m5" ? 400 : tf === "m15" ? 400 : tf === "h1" ? 500 : tf === "h4" ? 400 : 300;
        const candles: Candle[] = [];
        let price = inst.basePrice * (0.96 + rng() * 0.08);
        const startTime = now - count * tfSec;
        const alignedStart = Math.floor(startTime / tfSec) * tfSec;
        for (let i = 0; i < count; i++) {
          const t = alignedStart + i * tfSec;
          const dt = tfSec / (365 * 24 * 3600);
          const session = getSessionMultiplier(new Date(t * 1000).getUTCHours());
          const localVol = inst.volatility * session.vol * 1.2;
          let mu = 0;
          const regimeRoll = (i / count + rng() * 0.2) % 1;
          if (regimeRoll < 0.45) mu = inst.volatility * 0.15;
          else if (regimeRoll < 0.9) mu = -inst.volatility * 0.12;
          const open = price;
          let high = open, low = open;
          const steps = tf === "d1" ? 24 : tf === "h1" || tf === "h4" ? 12 : 6;
          for (let s = 0; s < steps; s++) {
            const z = gaussian(rng);
            const ret = (mu * dt + localVol * Math.sqrt(dt) * z) / steps;
            price = price * Math.exp(ret);
            if (price > high) high = price;
            if (price < low) low = price;
          }
          const close = price;
          const volume = Math.max(1, (inst.lotSize / 1000) * (0.5 + rng()) * session.vol * 100);
          candles.push({ time: t, open, high, low, close, volume });
        }
        st.candles[tf] = candles;
        st.price = candles[candles.length - 1].close;
        st.sessionOpen = candles[Math.max(0, candles.length - 24)].open;
        st.sessionHigh = Math.max(...candles.slice(-24).map((c) => c.high));
        st.sessionLow = Math.min(...candles.slice(-24).map((c) => c.low));
      }
    }
    console.log(`[engine] warmed up ${this.symbols.length} symbols`);
  }

  tick() {
    const now = Math.floor(Date.now() / 1000);
    const hourUTC = new Date().getUTCHours();
    const session = getSessionMultiplier(hourUTC);
    for (const symbol of this.symbols) {
      const st = this.states.get(symbol)!;
      const inst = st.instrument;
      const rng = this.rng(symbol);
      const dt = 1 / (365 * 24 * 3600);
      if (rng() < 0.002) { st.regime = pickRegime(rng, st.regime); st.regimeStrength = 0.3 + rng() * 0.6; }
      let mu = 0;
      switch (st.regime) {
        case "trend_up": mu = inst.volatility * 0.18 * st.regimeStrength; break;
        case "trend_down": mu = -inst.volatility * 0.16 * st.regimeStrength; break;
        case "range": mu = ((st.sessionOpen - st.price) / st.price) * 0.5; break;
        case "volatile": mu = (rng() - 0.5) * inst.volatility * 0.3; break;
      }
      st.momentum = st.momentum * 0.92 + gaussian(rng) * inst.volatility * 0.05;
      mu += st.momentum;
      const localVol = inst.volatility * session.vol * Math.sqrt(dt) * 8;
      const z = gaussian(rng);
      const ret = mu * dt + localVol * z;
      const newPrice = Math.max(st.price * Math.exp(ret), inst.pipSize);
      st.price = newPrice;
      if (newPrice > st.sessionHigh) st.sessionHigh = newPrice;
      if (newPrice < st.sessionLow) st.sessionLow = newPrice;
      st.lastTickTime = now;
      for (const tf of Object.keys(TIMEFRAMES)) {
        const tfSec = TIMEFRAMES[tf];
        const candles = st.candles[tf];
        const bucket = Math.floor(now / tfSec) * tfSec;
        const last = candles[candles.length - 1];
        if (!last || last.time < bucket) {
          const open = last ? last.close : newPrice;
          candles.push({ time: bucket, open, high: Math.max(open, newPrice), low: Math.min(open, newPrice), close: newPrice, volume: inst.lotSize / 1000 * (0.3 + rng()) });
          if (candles.length > 600) candles.shift();
        } else {
          last.close = newPrice;
          if (newPrice > last.high) last.high = newPrice;
          if (newPrice < last.low) last.low = newPrice;
          last.volume += inst.lotSize / 1000 * (0.05 + rng() * 0.1);
        }
      }
    }
  }

  getQuote(symbol: string): Quote | null {
    const st = this.states.get(symbol);
    if (!st) return null;
    const inst = st.instrument;
    const spreadPrice = inst.spreadPips * inst.pipSize;
    const bid = st.price - spreadPrice / 2;
    const ask = st.price + spreadPrice / 2;
    const changeAbs = st.price - st.sessionOpen;
    const changePct = (changeAbs / st.sessionOpen) * 100;
    return { symbol, bid, ask, last: st.price, spread: spreadPrice, changePct, changeAbs, high: st.sessionHigh, low: st.sessionLow, open: st.sessionOpen, time: st.lastTickTime, digits: inst.digits };
  }
  getAllQuotes(): Quote[] { return this.symbols.map((s) => this.getQuote(s)!).filter(Boolean); }
  getCandles(symbol: string, timeframe: string, count = 200): Candle[] {
    const st = this.states.get(symbol);
    if (!st) return [];
    return (st.candles[timeframe] || []).slice(-count);
  }
  getSession() { return getSessionMultiplier(new Date().getUTCHours()); }
  getInstruments() { return DEFAULT_INSTRUMENTS; }
}

const engine = new MarketEngine();

// ---------- REST API (port 3004) — for Next.js server-side fetches ----------
const restServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url || "/", `http://localhost:${REST_PORT}`);
  const path = url.pathname;
  const params = url.searchParams;
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (path === "/quotes") {
    res.writeHead(200); res.end(JSON.stringify({ quotes: engine.getAllQuotes(), session: engine.getSession(), time: Date.now() })); return;
  }
  if (path === "/instruments") { res.writeHead(200); res.end(JSON.stringify(engine.getInstruments())); return; }
  if (path === "/session") { res.writeHead(200); res.end(JSON.stringify(engine.getSession())); return; }
  if (path === "/candles") {
    const symbol = params.get("symbol") || "EURUSD";
    const tf = params.get("tf") || "h1";
    const count = parseInt(params.get("count") || "200", 10);
    res.writeHead(200); res.end(JSON.stringify({ symbol, timeframe: tf, candles: engine.getCandles(symbol, tf, count), quote: engine.getQuote(symbol) })); return;
  }
  res.writeHead(404); res.end(JSON.stringify({ error: "not found" }));
});

// ---------- Socket.io (port 3003) — real-time push to frontend ----------
const wsServer = createServer();
const io = new Server(wsServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);
  socket.emit("quotes", { quotes: engine.getAllQuotes(), session: engine.getSession(), time: Date.now() });
  socket.on("subscribe", () => {
    socket.emit("quotes", { quotes: engine.getAllQuotes(), session: engine.getSession(), time: Date.now() });
  });
  socket.on("disconnect", () => { console.log(`[ws] client disconnected: ${socket.id}`); });
});

// Tick engine every 1s and broadcast
setInterval(() => {
  engine.tick();
  io.emit("quotes", { quotes: engine.getAllQuotes(), session: engine.getSession(), time: Date.now() });
}, 1000);

const REST_PORT = 3004;
const WS_PORT = 3003;

restServer.listen(REST_PORT, () => { console.log(`[market-stream] REST API on port ${REST_PORT}`); });
wsServer.listen(WS_PORT, () => { console.log(`[market-stream] WebSocket on port ${WS_PORT}`); });

process.on("SIGTERM", () => { restServer.close(); wsServer.close(() => process.exit(0)); });
process.on("SIGINT", () => { restServer.close(); wsServer.close(() => process.exit(0)); });
