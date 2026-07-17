/**
 * AI Service — uses z-ai-web-dev-sdk for market interpretation & chat.
 * Provider-agnostic: swap ZAI.create() for OpenAI/Claude/Gemini by replacing
 * the adapter. All AI calls happen server-side only.
 */
import ZAI from "z-ai-web-dev-sdk";
import type { AnalysisSummary, PairAnalysis } from "@/lib/market/analysis";
import { buildAnalysisSummary } from "@/lib/market/analysis";

declare global {
  var __zai: any | undefined;
}

async function getAI() {
  if (!global.__zai) {
    global.__zai = await ZAI.create();
  }
  return global.__zai;
}

export interface AIInterpretation {
  symbol: string;
  verdict: string;
  scenarios: { name: string; probability: number; description: string }[];
  keyDrivers: string[];
  riskWarnings: string[];
  recommendation: string;
  fullText: string;
}

/**
 * Ask the AI to interpret a structured quant analysis into a human-readable
 * trading briefing. The AI does NOT make the decision — it explains the data.
 */
export async function interpretAnalysis(
  analysis: PairAnalysis,
  summary: AnalysisSummary
): Promise<AIInterpretation> {
  const zai = await getAI();

  const systemPrompt = `You are the senior market analyst of a professional AI Trading Terminal.
You receive STRUCTURED QUANTITATIVE DATA that has already been computed from real price action (indicators, trend, volatility, signal score, risk score).
Your job is ONLY to:
1. Interpret what the numbers mean in plain language.
2. Lay out 2-3 plausible scenarios with probability estimates.
3. List the key drivers behind the current setup.
4. Warn about risks.
5. Give a concise final recommendation that STRICTLY matches the computed action.

You must NOT invent prices, levels, or indicators that are not in the data.
You must NOT change the computed action (buy/sell/hold/wait).
Be precise, professional, and Bloomberg-terminal-grade concise.
Respond in valid JSON only with this schema:
{
  "verdict": "one or two sentence headline",
  "scenarios": [{"name": "...", "probability": 0-100, "description": "..."}],
  "keyDrivers": ["...","..."],
  "riskWarnings": ["...","..."],
  "recommendation": "concise actionable line"
}`;

  const userPrompt = `Instrument: ${analysis.symbol} (${analysis.trend}, ${analysis.volatility} volatility)
Price: ${analysis.price}
Session: ${analysis.session} (${analysis.liquidity} liquidity)
Computed action: ${summary.action.toUpperCase()} (confidence ${summary.confidence}%)
Entry zone: ${summary.entryZone}
Stop loss: ${summary.stopLoss}
Take profit: ${summary.takeProfit}
Risk score: ${summary.riskScore}/100

Indicators:
- RSI(14): ${analysis.rsi}
- MACD: ${analysis.macd} (signal ${analysis.macdSignal}, hist ${analysis.macdHist})
- ATR(14): ${analysis.atr} (${analysis.atrPct}%)
- ADX: ${analysis.adx}
- Stochastic %K/${analysis.stochasticK} %D ${analysis.stochasticD}
- VWAP: ${analysis.vwap}
- EMA20/50/200: ${analysis.ema20} / ${analysis.ema50} / ${analysis.ema200}
- Bollinger upper/mid/lower: ${analysis.bbUpper} / ${analysis.bbMiddle} / ${analysis.bbLower}
- Support: ${analysis.support}  Resistance: ${analysis.resistance}
- Signal score: ${analysis.signalScore}/100

Quant rationale: ${summary.rationale}`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content || "";
    // Extract JSON from possibly wrapped response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = null;
      }
    }
    if (parsed) {
      return {
        symbol: analysis.symbol,
        verdict: parsed.verdict || "",
        scenarios: parsed.scenarios || [],
        keyDrivers: parsed.keyDrivers || [],
        riskWarnings: parsed.riskWarnings || [],
        recommendation: parsed.recommendation || summary.summary,
        fullText: raw,
      };
    }
    // Fallback: use raw text
    return {
      symbol: analysis.symbol,
      verdict: summary.summary,
      scenarios: [],
      keyDrivers: [],
      riskWarnings: [],
      recommendation: summary.summary,
      fullText: raw,
    };
  } catch (err: any) {
    return {
      symbol: analysis.symbol,
      verdict: summary.summary,
      scenarios: [
        {
          name: summary.action === "buy" ? "Bullish continuation" : summary.action === "sell" ? "Bearish continuation" : "Range persists",
          probability: summary.confidence,
          description: summary.rationale,
        },
      ],
      keyDrivers: [summary.summary],
      riskWarnings: [`Risk score ${summary.riskScore}/100 — manage position size.`],
      recommendation: summary.summary,
      fullText: `AI interpretation unavailable (${err.message}). Showing quant summary.`,
    };
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Conversational assistant. Receives current market context so answers are
 * grounded in real data, not hallucination.
 */
export async function chatWithContext(
  messages: ChatMessage[],
  context: { marketOverview: string; topMovers: string; analysisDigest: string }
): Promise<string> {
  const zai = await getAI();

  const systemPrompt = `You are the AI co-pilot of a professional AI Trading Terminal.
You have LIVE access to the terminal's computed market data (provided below).
Rules:
- Ground every answer in the provided market data. Quote real numbers.
- When asked "what should I trade", reference the computed signals and confidence scores.
- When asked about a specific instrument, use its analysis digest.
- Be concise, terminal-grade. Use short paragraphs and bullets.
- Never invent prices or indicators not in the context.
- If data is missing, say so.

LIVE TERMINAL CONTEXT:
${context.marketOverview}

TOP MOVERS:
${context.topMovers}

ANALYSIS DIGEST (per instrument):
${context.analysisDigest}`;

  const aiMessages = [
    { role: "assistant", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const completion = await zai.chat.completions.create({
      messages: aiMessages,
      thinking: { type: "disabled" },
    });
    return completion.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (err: any) {
    return `AI service temporarily unavailable: ${err.message}. The quantitative analysis is still running — check the Analysis panel.`;
  }
}

/**
 * Generate a daily market briefing across all instruments.
 */
export async function generateMarketBriefing(
  allAnalysis: PairAnalysis[]
): Promise<string> {
  const zai = await getAI();
  const summaries = allAnalysis
    .slice(0, 16)
    .map((a) => {
      const s = buildAnalysisSummary(a);
      return `${a.symbol}: ${s.action.toUpperCase()} (conf ${s.confidence}%, risk ${s.riskScore}) — ${a.trend}, RSI ${a.rsi}, ${a.volatility} vol`;
    })
    .join("\n");

  const systemPrompt = `You are the chief strategist of an AI Trading Terminal. Write a tight, professional market briefing in Markdown. Group by category (Forex, Metals, Crypto, Indices). Highlight the top 3 opportunities and the top 2 risks. Max 250 words. No fluff.`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Current computed signals:\n${summaries}` },
      ],
      thinking: { type: "disabled" },
    });
    return completion.choices[0]?.message?.content || "";
  } catch (err: any) {
    return `## Market Briefing\n\nAI interpretation unavailable (${err.message}). Quant signals above remain valid.`;
  }
}
