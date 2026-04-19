type CacheEntry<T> = {
  data: T;
  expiry: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

let lastWriteTime: number | null = null;

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiry: Date.now() + ttlMs });
  lastWriteTime = Date.now();
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function getLastCacheTime(): number | null {
  return lastWriteTime;
}

/**
 * Fetch with simple in-memory caching.
 * Returns cached data if still valid, otherwise calls fetcher and caches the result.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  // Deduplicate concurrent requests for the same key
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetcher().then((data) => {
    setCache(key, data, ttlMs);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}
