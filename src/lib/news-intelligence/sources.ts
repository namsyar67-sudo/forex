/**
 * News Sources Configuration
 * Configurable list of trusted financial news sources.
 * Sources can be added/removed easily by editing this file.
 *
 * Each source has a reliability weight (0..1) used by the News Verification Agent.
 */

export interface NewsSource {
  id: string;
  name: string;
  category: "wire" | "financial" | "crypto" | "forex" | "general";
  reliability: number; // 0..1 — higher = more trusted
  speed: number;        // 0..1 — higher = faster to publish
  url: string;
  enabled: boolean;
  region: string;       // US, EU, UK, JP, Global, etc.
}

export const NEWS_SOURCES: NewsSource[] = [
  // Tier 1 — Wire services (highest reliability)
  { id: "reuters", name: "Reuters", category: "wire", reliability: 0.95, speed: 0.95, url: "https://www.reuters.com", enabled: true, region: "Global" },
  { id: "bloomberg", name: "Bloomberg", category: "wire", reliability: 0.95, speed: 0.92, url: "https://www.bloomberg.com", enabled: true, region: "Global" },
  { id: "ap", name: "Associated Press", category: "wire", reliability: 0.93, speed: 0.90, url: "https://apnews.com", enabled: true, region: "US" },
  { id: "wsj", name: "Wall Street Journal", category: "wire", reliability: 0.92, speed: 0.85, url: "https://www.wsj.com", enabled: true, region: "US" },
  { id: "ft", name: "Financial Times", category: "wire", reliability: 0.92, speed: 0.83, url: "https://www.ft.com", enabled: true, region: "EU" },

  // Tier 2 — Financial news
  { id: "cnbc", name: "CNBC", category: "financial", reliability: 0.85, speed: 0.90, url: "https://www.cnbc.com", enabled: true, region: "US" },
  { id: "marketwatch", name: "MarketWatch", category: "financial", reliability: 0.83, speed: 0.88, url: "https://www.marketwatch.com", enabled: true, region: "US" },
  { id: "investing", name: "Investing.com", category: "financial", reliability: 0.80, speed: 0.92, url: "https://www.investing.com", enabled: true, region: "Global" },
  { id: "seekingalpha", name: "Seeking Alpha", category: "financial", reliability: 0.75, speed: 0.80, url: "https://seekingalpha.com", enabled: true, region: "US" },
  { id: "barrons", name: "Barron's", category: "financial", reliability: 0.85, speed: 0.78, url: "https://www.barrons.com", enabled: true, region: "US" },

  // Tier 3 — Forex specific
  { id: "fxstreet", name: "FXStreet", category: "forex", reliability: 0.78, speed: 0.90, url: "https://www.fxstreet.com", enabled: true, region: "Global" },
  { id: "dailyfx", name: "DailyFX", category: "forex", reliability: 0.77, speed: 0.88, url: "https://www.dailyfx.com", enabled: true, region: "Global" },
  { id: "forexlive", name: "Forex Live", category: "forex", reliability: 0.76, speed: 0.92, url: "https://www.forexlive.com", enabled: true, region: "Global" },
  { id: "forexcom", name: "FOREX.com", category: "forex", reliability: 0.75, speed: 0.85, url: "https://www.forex.com", enabled: true, region: "Global" },

  // Tier 4 — Crypto specific
  { id: "coindesk", name: "CoinDesk", category: "crypto", reliability: 0.82, speed: 0.95, url: "https://www.coindesk.com", enabled: true, region: "Global" },
  { id: "cointelegraph", name: "Cointelegraph", category: "crypto", reliability: 0.78, speed: 0.93, url: "https://cointelegraph.com", enabled: true, region: "Global" },
  { id: "decrypt", name: "Decrypt", category: "crypto", reliability: 0.75, speed: 0.90, url: "https://decrypt.co", enabled: true, region: "Global" },
  { id: "theblock", name: "The Block", category: "crypto", reliability: 0.80, speed: 0.88, url: "https://www.theblock.co", enabled: true, region: "Global" },

  // Tier 5 — General / regional
  { id: "yahoo", name: "Yahoo Finance", category: "general", reliability: 0.72, speed: 0.85, url: "https://finance.yahoo.com", enabled: true, region: "US" },
  { id: "bbc", name: "BBC Business", category: "general", reliability: 0.88, speed: 0.75, url: "https://www.bbc.com/business", enabled: true, region: "UK" },
  { id: "nikkei", name: "Nikkei Asia", category: "general", reliability: 0.87, speed: 0.72, url: "https://asia.nikkei.com", enabled: true, region: "JP" },
  { id: "scmp", name: "SCMP Markets", category: "general", reliability: 0.78, speed: 0.70, url: "https://www.scmp.com/business", enabled: true, region: "Asia" },
];

export function getEnabledSources(): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.enabled);
}

export function getSourceById(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}

export function getSourcesByCategory(category: NewsSource["category"]): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.enabled && s.category === category);
}
