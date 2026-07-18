/**
 * Specialized Agents Implementation
 * Each agent focuses on one domain and produces a structured report.
 */
import type { Agent, AgentContext, AgentReport, AgentFactor, AgentRecommendation } from "./types";
import { scoreToConfidence, scoreToRecommendation } from "./types";

// ============================================================
// 1. TECHCIAL ANALYSIS AGENT
// ============================================================
export const TechnicalAgent: Agent = {
  type: "technical",
  name: "Technical Analysis Agent",
  weight: 0.25,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const a = ctx.analysis;
    if (!a) {
      return emptyReport("technical", ctx.symbol, "No technical analysis data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // Trend
    if (a.trend === "Bullish") { score += 25; factors.push({ name: "Trend", value: "Bullish", impact: "positive", weight: 0.2 }); }
    else if (a.trend === "Bearish") { score -= 25; factors.push({ name: "Trend", value: "Bearish", impact: "negative", weight: 0.2 }); }
    else { factors.push({ name: "Trend", value: "Sideways", impact: "neutral", weight: 0.1 }); }

    // RSI
    if (a.rsi < 30) { score += 18; factors.push({ name: "RSI(14)", value: `${a.rsi} oversold`, impact: "positive", weight: 0.15 }); }
    else if (a.rsi > 70) { score -= 18; factors.push({ name: "RSI(14)", value: `${a.rsi} overbought`, impact: "negative", weight: 0.15 }); }
    else { factors.push({ name: "RSI(14)", value: `${a.rsi}`, impact: "neutral", weight: 0.05 }); }

    // MACD
    if (a.macdHist > 0) { score += 12; factors.push({ name: "MACD", value: "Bullish histogram", impact: "positive", weight: 0.1 }); }
    else { score -= 12; factors.push({ name: "MACD", value: "Bearish histogram", impact: "negative", weight: 0.1 }); }

    // ADX (trend strength)
    if (a.adx > 25) { factors.push({ name: "ADX", value: `${a.adx} strong trend`, impact: score > 0 ? "positive" : "negative", weight: 0.1 }); }
    else { factors.push({ name: "ADX", value: `${a.adx} weak trend`, impact: "neutral", weight: 0.05 }); }

    // EMA alignment
    if (a.ema20 > a.ema50 && a.ema50 > a.ema200) { score += 15; factors.push({ name: "EMA Stack", value: "20>50>200 bullish", impact: "positive", weight: 0.15 }); }
    else if (a.ema20 < a.ema50 && a.ema50 < a.ema200) { score -= 15; factors.push({ name: "EMA Stack", value: "20<50<200 bearish", impact: "negative", weight: 0.15 }); }

    // Bollinger position
    const bbPos = (a.price - a.bbLower) / (a.bbUpper - a.bbLower || 1);
    if (bbPos < 0.2) { score += 10; factors.push({ name: "Bollinger", value: "Near lower band", impact: "positive", weight: 0.08 }); }
    else if (bbPos > 0.8) { score -= 10; factors.push({ name: "Bollinger", value: "Near upper band", impact: "negative", weight: 0.08 }); }

    // Support/Resistance
    factors.push({ name: "Support", value: a.support.toFixed(a.quote?.digits || 5), impact: "positive", weight: 0.05 });
    factors.push({ name: "Resistance", value: a.resistance.toFixed(a.quote?.digits || 5), impact: "negative", weight: 0.05 });

    const recommendation = scoreToRecommendation(score);
    const confidence = scoreToConfidence(score);

    return {
      agent: "technical",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.25,
      summary: `${a.trend} trend, RSI ${a.rsi}, ADX ${a.adx}, MACD ${a.macdHist > 0 ? "bullish" : "bearish"}. Signal: ${a.signal}.`,
      factors,
      data: { rsi: a.rsi, adx: a.adx, macdHist: a.macdHist, trend: a.trend, signal: a.signal, ema20: a.ema20, ema50: a.ema50, ema200: a.ema200 },
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 2. NEWS ANALYSIS AGENT
// ============================================================
export const NewsAgent: Agent = {
  type: "news",
  name: "News Analysis Agent",
  weight: 0.15,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const news = ctx.newsImpact;
    if (!news) {
      return emptyReport("news", ctx.symbol, "No news data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // High impact news count
    const highImpact = news.highImpactCount || 0;
    if (highImpact === 0) { score += 15; factors.push({ name: "High Impact News", value: "None", impact: "positive", weight: 0.3 }); }
    else if (highImpact <= 2) { score += 5; factors.push({ name: "High Impact News", value: `${highImpact} items`, impact: "neutral", weight: 0.2 }); }
    else { score -= 20; factors.push({ name: "High Impact News", value: `${highImpact} items`, impact: "negative", weight: 0.3 }); }

    // Symbol-specific risk
    const symbolRisk = (news.topRiskSymbols || []).find((s: any) => s.symbol === ctx.symbol);
    if (symbolRisk) {
      const risk = symbolRisk.risk;
      if (risk > 70) { score -= 15; factors.push({ name: "Symbol News Risk", value: `${risk}/100`, impact: "negative", weight: 0.25 }); }
      else if (risk > 40) { factors.push({ name: "Symbol News Risk", value: `${risk}/100`, impact: "neutral", weight: 0.15 }); }
      else { factors.push({ name: "Symbol News Risk", value: `${risk}/100`, impact: "positive", weight: 0.1 }); }
    }

    // News items mentioning this symbol
    const relevantNews = (news.items || []).filter((n: any) => n.affectedSymbols?.includes(ctx.symbol));
    factors.push({ name: "Relevant News", value: `${relevantNews.length} items`, impact: relevantNews.length > 3 ? "negative" : "neutral", weight: 0.15 });

    // Category bias
    const hasMacro = relevantNews.some((n: any) => n.category === "macro");
    if (hasMacro) { factors.push({ name: "Macro News", value: "Present", impact: "neutral", weight: 0.1 }); }

    const recommendation: AgentRecommendation = highImpact > 3 ? "WAIT" : scoreToRecommendation(score);
    const confidence = Math.min(100, 40 + highImpact * 5);

    return {
      agent: "news",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.15,
      summary: `${highImpact} high-impact news items. ${symbolRisk ? `Symbol risk: ${symbolRisk.risk}/100.` : "No direct symbol risk."} ${relevantNews.length} relevant items.`,
      factors,
      data: { highImpactCount: highImpact, symbolRisk: symbolRisk?.risk || 0, relevantNewsCount: relevantNews.length },
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 3. SENTIMENT ANALYSIS AGENT
// ============================================================
export const SentimentAgent: Agent = {
  type: "sentiment",
  name: "Sentiment Analysis Agent",
  weight: 0.10,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const hm = ctx.heatmap;
    const a = ctx.analysis;
    if (!hm && !a) {
      return emptyReport("sentiment", ctx.symbol, "No sentiment data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // Currency strength from heatmap
    if (hm) {
      // Extract the base/quote currencies from symbol
      const baseCur = ctx.symbol.substring(0, 3);
      const quoteCur = ctx.symbol.substring(3, 6);
      const baseStrength = hm.currencies?.find((c: any) => c.currency === baseCur)?.strength || 0;
      const quoteStrength = hm.currencies?.find((c: any) => c.currency === quoteCur)?.strength || 0;
      const diff = baseStrength - quoteStrength;
      score += Math.max(-30, Math.min(30, diff * 0.5));

      if (diff > 20) { factors.push({ name: `${baseCur} Strength`, value: `${baseStrength} vs ${quoteCur} ${quoteStrength}`, impact: "positive", weight: 0.3 }); }
      else if (diff < -20) { factors.push({ name: `${baseCur} Weakness`, value: `${baseStrength} vs ${quoteCur} ${quoteStrength}`, impact: "negative", weight: 0.3 }); }
      else { factors.push({ name: "Currency Balance", value: `${baseCur} ${baseStrength} vs ${quoteCur} ${quoteStrength}`, impact: "neutral", weight: 0.15 }); }
    }

    // RSI as sentiment proxy
    if (a) {
      if (a.rsi < 35) { score += 10; factors.push({ name: "RSI Sentiment", value: "Oversold recovery", impact: "positive", weight: 0.15 }); }
      else if (a.rsi > 65) { score -= 10; factors.push({ name: "RSI Sentiment", value: "Overbought", impact: "negative", weight: 0.15 }); }
    }

    // Session sentiment
    if (ctx.sessionAnalysis) {
      const active = ctx.sessionAnalysis.currentSession;
      if (active?.volMultiplier > 1.3) { score += 5; factors.push({ name: "Session", value: `${active.name} (high activity)`, impact: "positive", weight: 0.1 }); }
      else { factors.push({ name: "Session", value: active?.name || "Unknown", impact: "neutral", weight: 0.05 }); }
    }

    const recommendation = scoreToRecommendation(score);
    const confidence = scoreToConfidence(score);

    return {
      agent: "sentiment",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.10,
      summary: `Currency strength differential and RSI sentiment analysis.`,
      factors,
      data: {},
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 4. RISK MANAGEMENT AGENT
// ============================================================
export const RiskAgent: Agent = {
  type: "risk",
  name: "Risk Management Agent",
  weight: 0.20,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const a = ctx.analysis;
    if (!a) {
      return emptyReport("risk", ctx.symbol, "No risk data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // Risk score
    if (a.riskScore < 30) { score += 20; factors.push({ name: "Risk Score", value: `${a.riskScore}/100 low`, impact: "positive", weight: 0.3 }); }
    else if (a.riskScore < 50) { score += 10; factors.push({ name: "Risk Score", value: `${a.riskScore}/100 moderate`, impact: "positive", weight: 0.2 }); }
    else if (a.riskScore < 70) { score -= 5; factors.push({ name: "Risk Score", value: `${a.riskScore}/100 elevated`, impact: "negative", weight: 0.2 }); }
    else { score -= 20; factors.push({ name: "Risk Score", value: `${a.riskScore}/100 high`, impact: "negative", weight: 0.3 }); }

    // Volatility
    if (a.volatility === "Low") { score += 10; factors.push({ name: "Volatility", value: "Low", impact: "positive", weight: 0.2 }); }
    else if (a.volatility === "Moderate") { factors.push({ name: "Volatility", value: "Moderate", impact: "neutral", weight: 0.15 }); }
    else if (a.volatility === "High") { score -= 10; factors.push({ name: "Volatility", value: "High", impact: "negative", weight: 0.2 }); }
    else { score -= 15; factors.push({ name: "Volatility", value: "Extreme", impact: "negative", weight: 0.25 }); }

    // Liquidity
    if (a.liquidity === "Deep") { score += 10; factors.push({ name: "Liquidity", value: "Deep", impact: "positive", weight: 0.15 }); }
    else if (a.liquidity === "Normal") { factors.push({ name: "Liquidity", value: "Normal", impact: "neutral", weight: 0.1 }); }
    else { score -= 10; factors.push({ name: "Liquidity", value: "Thin", impact: "negative", weight: 0.15 }); }

    // Spread
    if (a.spreadPips < 5) { score += 5; factors.push({ name: "Spread", value: `${a.spreadPips} pips tight`, impact: "positive", weight: 0.1 }); }
    else if (a.spreadPips < 15) { factors.push({ name: "Spread", value: `${a.spreadPips} pips`, impact: "neutral", weight: 0.08 }); }
    else { score -= 8; factors.push({ name: "Spread", value: `${a.spreadPips} pips wide`, impact: "negative", weight: 0.12 }); }

    // ATR-based position sizing suggestion
    const atrPct = a.atrPct;
    factors.push({ name: "ATR%", value: `${atrPct}%`, impact: atrPct > 1.5 ? "negative" : "neutral", weight: 0.1 });

    const recommendation: AgentRecommendation = a.riskScore > 70 ? "WAIT" : scoreToRecommendation(score);
    const confidence = Math.min(100, 50 + (100 - a.riskScore) * 0.5);

    return {
      agent: "risk",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.20,
      summary: `Risk score ${a.riskScore}/100, ${a.volatility} volatility, ${a.liquidity} liquidity, ${a.spreadPips} pip spread.`,
      factors,
      data: { riskScore: a.riskScore, volatility: a.volatility, liquidity: a.liquidity, spreadPips: a.spreadPips, atrPct: a.atrPct },
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 5. SMART MONEY AGENT (ICT)
// ============================================================
export const SmartMoneyAgent: Agent = {
  type: "technical",
  name: "Smart Money Agent",
  weight: 0.20,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const smc = ctx.smc;
    if (!smc) {
      return emptyReport("technical", ctx.symbol, "No Smart Money data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // Bias
    if (smc.summary.bias === "bullish") { score += 25 * smc.summary.biasStrength; factors.push({ name: "SMC Bias", value: `Bullish (${(smc.summary.biasStrength * 100).toFixed(0)}%)`, impact: "positive", weight: 0.3 }); }
    else if (smc.summary.bias === "bearish") { score -= 25 * smc.summary.biasStrength; factors.push({ name: "SMC Bias", value: `Bearish (${(smc.summary.biasStrength * 100).toFixed(0)}%)`, impact: "negative", weight: 0.3 }); }

    // Market structure
    if (smc.summary.marketStructure === "bullish") { score += 10; factors.push({ name: "Market Structure", value: "Bullish", impact: "positive", weight: 0.15 }); }
    else if (smc.summary.marketStructure === "bearish") { score -= 10; factors.push({ name: "Market Structure", value: "Bearish", impact: "negative", weight: 0.15 }); }

    // Last BOS
    if (smc.summary.lastBOS) {
      const bos = smc.summary.lastBOS;
      if (bos.direction === "bullish") { score += 8; factors.push({ name: "Last BOS", value: `${bos.type} bullish`, impact: "positive", weight: 0.1 }); }
      else { score -= 8; factors.push({ name: "Last BOS", value: `${bos.type} bearish`, impact: "negative", weight: 0.1 }); }
    }

    // Last CHOCH
    if (smc.summary.lastCHOCH) {
      const choch = smc.summary.lastCHOCH;
      if (choch.direction === "bullish") { score += 12; factors.push({ name: "Last CHOCH", value: `Bullish reversal`, impact: "positive", weight: 0.12 }); }
      else { score -= 12; factors.push({ name: "Last CHOCH", value: `Bearish reversal`, impact: "negative", weight: 0.12 }); }
    }

    // Order Blocks
    if (smc.summary.activeOrderBlocks > 0) {
      factors.push({ name: "Active Order Blocks", value: `${smc.summary.activeOrderBlocks}`, impact: "neutral", weight: 0.08 });
    }

    // FVGs
    if (smc.summary.activeFVGs > 0) {
      factors.push({ name: "Active FVGs", value: `${smc.summary.activeFVGs}`, impact: "neutral", weight: 0.06 });
    }

    // Liquidity sweeps
    if (smc.summary.liquiditySwept > 0) {
      factors.push({ name: "Liquidity Swept", value: `${smc.summary.liquiditySwept} zones`, impact: "positive", weight: 0.1 });
      score += 5;
    }

    // Premium/Discount
    const pd = smc.premiumDiscount;
    if (pd) {
      if (pd.position < 0.35) { score += 8; factors.push({ name: "Premium/Discount", value: "Discount zone", impact: "positive", weight: 0.1 }); }
      else if (pd.position > 0.65) { score -= 8; factors.push({ name: "Premium/Discount", value: "Premium zone", impact: "negative", weight: 0.1 }); }
      else { factors.push({ name: "Premium/Discount", value: "Equilibrium", impact: "neutral", weight: 0.05 }); }
    }

    const recommendation = scoreToRecommendation(score);
    const confidence = scoreToConfidence(score);

    return {
      agent: "technical",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.20,
      summary: `SMC bias: ${smc.summary.bias}. Structure: ${smc.summary.marketStructure}. ${smc.summary.activeOrderBlocks} OBs, ${smc.summary.activeFVGs} FVGs. ${smc.summary.liquiditySwept} liquidity sweeps.`,
      factors,
      data: { bias: smc.summary.bias, biasStrength: smc.summary.biasStrength, marketStructure: smc.summary.marketStructure, activeOBs: smc.summary.activeOrderBlocks, activeFVGs: smc.summary.activeFVGs },
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 6. EXECUTION AGENT
// ============================================================
export const ExecutionAgent: Agent = {
  type: "execution",
  name: "Execution Agent",
  weight: 0.05,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    const a = ctx.analysis;
    if (!a) {
      return emptyReport("execution", ctx.symbol, "No execution data available");
    }
    let score = 0;
    const factors: AgentFactor[] = [];

    // Spread check
    if (a.spreadPips < 3) { score += 15; factors.push({ name: "Spread", value: `${a.spreadPips} pips excellent`, impact: "positive", weight: 0.3 }); }
    else if (a.spreadPips < 8) { score += 8; factors.push({ name: "Spread", value: `${a.spreadPips} pips good`, impact: "positive", weight: 0.2 }); }
    else if (a.spreadPips < 20) { factors.push({ name: "Spread", value: `${a.spreadPips} pips acceptable`, impact: "neutral", weight: 0.1 }); }
    else { score -= 15; factors.push({ name: "Spread", value: `${a.spreadPips} pips wide`, impact: "negative", weight: 0.25 }); }

    // Session suitability
    if (a.session.includes("Overlap") || a.session.includes("London")) { score += 10; factors.push({ name: "Session", value: a.session, impact: "positive", weight: 0.2 }); }
    else if (a.session.includes("New York")) { score += 5; factors.push({ name: "Session", value: a.session, impact: "positive", weight: 0.15 }); }
    else { factors.push({ name: "Session", value: a.session, impact: "neutral", weight: 0.1 }); }

    // Liquidity for execution
    if (a.liquidity === "Deep") { score += 8; factors.push({ name: "Execution Liquidity", value: "Deep", impact: "positive", weight: 0.15 }); }
    else if (a.liquidity === "Thin") { score -= 10; factors.push({ name: "Execution Liquidity", value: "Thin", impact: "negative", weight: 0.2 }); }

    // Slippage risk
    if (a.volatility === "Extreme") { score -= 10; factors.push({ name: "Slippage Risk", value: "High (extreme vol)", impact: "negative", weight: 0.15 }); }

    const recommendation = scoreToRecommendation(score);
    const confidence = scoreToConfidence(score);

    return {
      agent: "execution",
      symbol: ctx.symbol,
      recommendation,
      confidence,
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.05,
      summary: `Execution conditions: ${a.spreadPips} pip spread, ${a.liquidity} liquidity, ${a.session}. ${a.volatility} volatility.`,
      factors,
      data: { spreadPips: a.spreadPips, liquidity: a.liquidity, session: a.session, volatility: a.volatility },
      timestamp: Date.now(),
    };
  },
};

// ============================================================
// 7. PORTFOLIO AGENT
// ============================================================
export const PortfolioAgent: Agent = {
  type: "portfolio",
  name: "Portfolio Agent",
  weight: 0.05,
  async analyze(ctx: AgentContext): Promise<AgentReport> {
    let score = 0;
    const factors: AgentFactor[] = [];

    // Check active signals count (diversification)
    const activeCount = ctx.activeSignals?.length || 0;
    if (activeCount === 0) { factors.push({ name: "Portfolio Diversity", value: "No open positions", impact: "neutral", weight: 0.2 }); }
    else if (activeCount < 3) { score += 5; factors.push({ name: "Portfolio Diversity", value: `${activeCount} positions`, impact: "positive", weight: 0.2 }); }
    else if (activeCount < 6) { factors.push({ name: "Portfolio Diversity", value: `${activeCount} positions`, impact: "neutral", weight: 0.15 }); }
    else { score -= 10; factors.push({ name: "Portfolio Diversity", value: `${activeCount} positions (over-diversified)`, impact: "negative", weight: 0.2 }); }

    // Correlation check
    const matrix = ctx.correlationMatrix;
    if (matrix && ctx.activeSignals) {
      const correlated = ctx.activeSignals.filter((s: any) => {
        // simplified: check if any active signal has high correlation with current symbol
        return s.symbol !== ctx.symbol;
      });
      if (correlated.length > 4) {
        score -= 8;
        factors.push({ name: "Correlation Risk", value: "Multiple correlated positions", impact: "negative", weight: 0.15 });
      }
    }

    // Category concentration
    const a = ctx.analysis;
    if (a) {
      factors.push({ name: "Asset Class", value: a.category || "unknown", impact: "neutral", weight: 0.1 });
    }

    const recommendation = scoreToRecommendation(score);
    const confidence = 50 + activeCount * 3;

    return {
      agent: "portfolio",
      symbol: ctx.symbol,
      recommendation,
      confidence: Math.min(100, confidence),
      score: Math.max(-100, Math.min(100, score)),
      weight: 0.05,
      summary: `${activeCount} active positions. Portfolio diversification and correlation assessment.`,
      factors,
      data: { activeCount },
      timestamp: Date.now(),
    };
  },
};

// ---------- Helper ----------
function emptyReport(agent: string, symbol: string, message: string): AgentReport {
  return {
    agent: agent as any,
    symbol,
    recommendation: "HOLD",
    confidence: 0,
    score: 0,
    weight: 0,
    summary: message,
    factors: [],
    data: {},
    timestamp: Date.now(),
  };
}

// ---------- All agents registry ----------
export const ALL_AGENTS: Agent[] = [
  TechnicalAgent,
  SmartMoneyAgent,
  NewsAgent,
  SentimentAgent,
  RiskAgent,
  ExecutionAgent,
  PortfolioAgent,
];
