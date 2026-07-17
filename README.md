# AI Trading Terminal

A production-grade, AI-powered trading terminal for real-time multi-asset market analysis. Built for a single operator — no login, no multi-tenancy, no roles. All configuration persists locally in SQLite.

## What it does

On launch, the terminal automatically:
- Streams live prices for 16 instruments across Forex, Metals, Crypto, and Indices
- Computes technical indicators (RSI, MACD, ATR, ADX, Stochastic, Bollinger Bands, VWAP, EMA 20/50/200) on real candle data
- Generates quant-based trading signals (STRONG_BUY → STRONG_SELL) with confidence and risk scores
- Detects trading sessions (Tokyo / London / New York / Overlap) with volatility-aware modeling
- Builds a correlation matrix across all instruments
- Generates AI market briefings and per-instrument interpretations (scenarios, key drivers, risk warnings)
- Produces a market-aware news wire and economic calendar
- Journals positions with live floating PnL and records AI decision history
- Sends alerts on trades, signals, and system events

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (single page)                                  │
│  ├── WebSocket ← port 3003 (live quotes, 1s push)       │
│  └── HTTP API  ← port 3000 (candles, analysis, AI, DB)  │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
       ┌───────▼────────┐        ┌───────▼────────┐
       │  Next.js 16    │        │ Market Stream  │
       │  (port 3000)   │        │ Service        │
       │                │ fetch  │ (port 3003 WS  │
       │  • API routes  │◄──────►│  + 3004 REST)  │
       │  • Prisma/SQL  │        │                │
       │  • AI service  │        │  Market Engine │
       │  • Indicators  │        │  (GBM sim,     │
       │  • Analysis    │        │   single       │
       └────────────────┘        │   source of    │
                                 │   truth)       │
                                 └────────────────┘
```

**Single source of truth:** The market-stream service owns the engine and serves both WebSocket (real-time push) and REST (candle/quote snapshots). Next.js API routes fetch from it server-side, guaranteeing price consistency between the live ticker and the charts/analysis.

**AI provider:** Uses `z-ai-web-dev-sdk` (server-side only). The AI interprets pre-computed quant data — it never invents prices or makes the trading decision. The `ai-service.ts` module is provider-agnostic: swap the adapter to use OpenAI/Claude/Gemini without touching consumers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Charts | Custom SVG candlestick engine |
| Database | Prisma ORM + SQLite |
| Real-time | Socket.io (mini-service) |
| AI | z-ai-web-dev-sdk (LLM) |
| State | Zustand (client) + polling (server) |

## Markets & Instruments

Forex: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, NZDUSD, USDCAD
Metals: XAUUSD (Gold), XAGUSD (Silver)
Crypto: BTCUSD, ETHUSD
Indices: NAS100, US30, SPX500, GER40, UK100

Each instrument provides: live price, bid/ask, spread, ATR, volume, trend, volatility, liquidity, session, correlation, AI analysis, risk score, signal, support/resistance, and full indicator breakdown.

## Getting Started

### Prerequisites
- Node.js 18+ / Bun
- The market engine runs entirely in-process — no external data feeds required.

### Install & Run

```bash
bun install

# Start the market-stream service (WebSocket + REST)
cd mini-services/market-stream && bun install && cd ..
bun --hot mini-services/market-stream/index.ts &

# Start the Next.js terminal
bun run dev

# Seed the database with default instruments
curl -X POST http://localhost:3000/api/seed
```

Open the **Preview Panel** to view the terminal. Click **Open in New Tab** for a full-screen experience.

### Production Build

```bash
bun run build
bun run start
```

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes (market, analysis, news, positions, chat…)
│   ├── page.tsx                # Terminal dashboard (single route)
│   ├── layout.tsx
│   └── globals.css             # Dark glassmorphism design system
├── components/
│   ├── terminal/               # Terminal panels (header, grid, chart, analysis, chat…)
│   └── charts/                 # SVG candlestick chart
├── hooks/
│   └── use-live-quotes.ts      # WebSocket + polling fallback
├── lib/
│   ├── ai/ai-service.ts        # LLM interpretation & chat (provider-agnostic)
│   ├── indicators/             # Technical analysis (RSI, MACD, ATR, ADX, BB…)
│   ├── market/                 # Engine client, analysis, news, instruments
│   ├── db.ts                   # Prisma client
│   ├── types.ts                # Shared types
│   └── format.ts               # Formatting utilities
mini-services/
└── market-stream/              # WebSocket + REST market data service
prisma/
└── schema.prisma               # Pairs, positions, decisions, alerts, news, settings
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/quotes` | All live quotes + session |
| GET | `/api/market/candles?symbol=&tf=&count=` | Candle history |
| GET | `/api/market/instruments` | Instrument metadata |
| GET | `/api/market/session` | Current trading session |
| GET | `/api/analysis` | Analysis for all instruments |
| GET | `/api/analysis/[symbol]` | Analysis for one instrument |
| GET | `/api/analysis/[symbol]/ai` | AI interpretation (verdict, scenarios) |
| GET | `/api/news` | AI-generated market news |
| GET | `/api/calendar` | Economic calendar |
| GET | `/api/positions` | Positions with live PnL |
| POST | `/api/positions` | Open a position |
| PATCH | `/api/positions/[id]` | Close / update a position |
| GET | `/api/decisions` | AI decision history |
| GET | `/api/alerts` | Alerts |
| POST | `/api/chat` | AI co-pilot (grounded in live data) |
| GET | `/api/briefing` | AI market briefing (markdown) |
| GET | `/api/correlation` | Correlation matrix |
| GET/POST | `/api/settings` | Terminal settings |
| POST | `/api/seed` | Seed default instruments |

## Design Principles

- **Quant-first, AI-second:** All signals come from real indicator math. The AI only interprets.
- **No fake data in the UI:** Every number on screen comes from the engine or the database.
- **Modular:** Each panel, API route, and service is independent and replaceable.
- **Production-ready:** Error handling, retry logic, graceful fallbacks (WS → polling).

## License

Private — single-operator terminal.
