/**
 * In-memory cache for expensive computations.
 * TTL-based eviction. Single-process (suitable for dev/single-instance).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function getOrCompute<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;
  const value = await compute();
  setCached(key, value, ttlMs);
  return value;
}

// Clear expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 60000).unref?.();
