/**
 * In-memory cache shared by all route handlers.
 * On Vercel each serverless instance keeps module scope alive between
 * invocations, so this survives warm requests. Cold starts refetch.
 */
const CACHE_TTL = 10 * 60 * 1000;

const store = new Map<string, { at: number; value: unknown }>();

export function cached<T>(key: string, ttlMs = CACHE_TTL, fn: () => T | Promise<T>): T | Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = fn();
  if (value instanceof Promise) {
    return value.then((v) => {
      set(key, v);
      return v;
    });
  }
  set(key, value);
  return value;
}

function set(key: string, value: unknown) {
  if (store.size > 300) store.clear();
  store.set(key, { at: Date.now(), value });
}

export function clearCache() {
  store.clear();
}
