// In-memory idempotency cache with TTL. TODO: replace with Redis for horizontal scale.
type Entry = { status: number; body: any; createdAt: number; ttlMs: number };
const store = new Map<string, Entry>();

export function getIdempotent(key?: string) {
  if (!key) return undefined;
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.createdAt > e.ttlMs) {
    store.delete(key);
    return undefined;
  }
  return e;
}

export function setIdempotent(key: string, status: number, body: any, ttlMs = 10 * 60 * 1000) {
  store.set(key, { status, body, createdAt: Date.now(), ttlMs });
}

