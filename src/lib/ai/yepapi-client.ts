/**
 * YepAPI Client with Key Rotation
 * API: https://api.yepapi.com
 * Auth: x-api-key header
 * Endpoints: POST /v1/ai/chat/completions (OpenAI-compatible)
 * Models: google/gemini-3.5-flash (news), z-ai/glm-5.2 (decisions)
 */
import { db } from "@/lib/db";

const DEFAULT_KEYS = [
  "yep_sk_73046039c844df52ee60ea30bce49eb3417b2db20285c13e",
  "yep_sk_14bdb5c959d61e0f9c5c7633d1dff3af290c2d2c9515fa8b",
  "yep_sk_b8e2ec27e095160d38c50d9767b96ad2c55eb1fabffaa747",
];
const BASE_URL = "https://api.yepapi.com";
const MODEL_NEWS = "google/gemini-3.5-flash";
const MODEL_DECISION = "z-ai/glm-5.2";

interface KeyState {
  key: string;
  status: "active" | "exhausted" | "error";
  lastError?: string;
  lastUsed?: number;
  requestCount: number;
}

declare global {
  var __yepKeys: KeyState[] | undefined;
  var __yepCurrentKey: number | undefined;
}

async function getKeys(): Promise<KeyState[]> {
  if (!global.__yepKeys) {
    try {
      const setting = await db.setting.findUnique({ where: { id: "yepapi_keys" } });
      if (setting) {
        const keys = JSON.parse(setting.value) as string[];
        global.__yepKeys = keys.map(k => ({ key: k, status: "active" as const, requestCount: 0 }));
      } else {
        global.__yepKeys = DEFAULT_KEYS.map(k => ({ key: k, status: "active" as const, requestCount: 0 }));
      }
    } catch {
      global.__yepKeys = DEFAULT_KEYS.map(k => ({ key: k, status: "active" as const, requestCount: 0 }));
    }
    global.__yepCurrentKey = 0;
  }
  return global.__yepKeys!;
}

async function getNextKey(): Promise<string | null> {
  const keys = await getKeys();
  for (let i = 0; i < keys.length; i++) {
    const idx = ((global.__yepCurrentKey || 0) + i) % keys.length;
    if (keys[idx].status === "active") {
      global.__yepCurrentKey = idx;
      keys[idx].lastUsed = Date.now();
      keys[idx].requestCount++;
      return keys[idx].key;
    }
  }
  for (const k of keys) k.status = "active";
  global.__yepCurrentKey = 0;
  keys[0].lastUsed = Date.now();
  keys[0].requestCount++;
  return keys[0].key;
}

async function markKeyExhausted(key: string, error: string) {
  const keys = await getKeys();
  const k = keys.find(k => k.key === key);
  if (k) { k.status = "exhausted"; k.lastError = error; }
}

export async function yepChat(
  messages: { role: string; content: string }[],
  model?: string,
  timeoutMs = 20000
): Promise<string> {
  const useModel = model || MODEL_DECISION;
  const keys = await getKeys();
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = await getNextKey();
    if (!apiKey) throw new Error("No API keys available");
    try {
      const response = await Promise.race([
        fetch(`${BASE_URL}/v1/ai/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ model: useModel, messages, max_tokens: 4096 }),
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
      ]);
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (response.status === 402 || response.status === 429) {
          await markKeyExhausted(apiKey, `HTTP ${response.status}`);
          continue;
        }
        throw new Error(`YepAPI ${response.status}: ${errText.substring(0, 200)}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.data?.message?.content || "";
    } catch (err: any) {
      if (err.message === "timeout" && attempt < keys.length - 1) continue;
      if (attempt < keys.length - 1) continue;
      throw err;
    }
  }
  throw new Error("All API keys exhausted or failed");
}

export async function yepNewsChat(messages: { role: string; content: string }[], timeoutMs = 15000): Promise<string> {
  return yepChat(messages, MODEL_NEWS, timeoutMs);
}

export async function yepDecisionChat(messages: { role: string; content: string }[], timeoutMs = 25000): Promise<string> {
  return yepChat(messages, MODEL_DECISION, timeoutMs);
}

export async function yepWebSearch(query: string, num = 5, timeoutMs = 15000): Promise<any[]> {
  try {
    const content = await yepNewsChat([
      { role: "assistant", content: "You are a financial news aggregator. Provide recent news headlines as JSON." },
      { role: "user", content: `Provide ${num} recent news headlines about: "${query}". Each: title, snippet (1-2 sentences), source, date. JSON: [{"title":"...","snippet":"...","source":"...","date":"..."}]` },
    ], timeoutMs);
    const match = content.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  } catch { return []; }
}

export function isYepAPIConfigured(): boolean { return true; }

export async function getApiKeyStatus() {
  const keys = await getKeys();
  return {
    keys: keys.map(k => ({ key: k.key.substring(0, 10) + "..." + k.key.substring(k.key.length - 4), status: k.status, lastError: k.lastError, lastUsed: k.lastUsed, requestCount: k.requestCount })),
    activeCount: keys.filter(k => k.status === "active").length,
  };
}

export async function updateApiKeys(newKeys: string[]) {
  await db.setting.upsert({ where: { id: "yepapi_keys" }, create: { id: "yepapi_keys", value: JSON.stringify(newKeys) }, update: { id: "yepapi_keys", value: JSON.stringify(newKeys) } });
  global.__yepKeys = newKeys.map(k => ({ key: k, status: "active" as const, requestCount: 0 }));
  global.__yepCurrentKey = 0;
  return { success: true, count: newKeys.length };
}

export async function resetKeyStatus() {
  const keys = await getKeys();
  for (const k of keys) { k.status = "active"; k.lastError = undefined; }
  global.__yepCurrentKey = 0;
  return { success: true };
}
