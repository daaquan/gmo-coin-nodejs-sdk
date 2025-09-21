// Idempotency cache with Redis fallback to in-memory.
import { getRedis, ensureRedisConnected } from './redis.js';

type Entry = { status: number; body: unknown; createdAt: number; ttlMs: number };
const store = new Map<string, Entry>();

export async function getIdempotent(key?: string): Promise<Entry | undefined> {
  if (!key) return undefined;
  const r = getRedis();
  if (!r) {
    const e = store.get(key);
    if (!e) return undefined;
    if (Date.now() - e.createdAt > e.ttlMs) {
      store.delete(key);
      return undefined;
    }
    return e;
  }
  await ensureRedisConnected();
  const raw = await r.get(`idem:${key}`);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Entry; } catch { return undefined; }
}

export async function setIdempotent(key: string, status: number, body: unknown, ttlMs = 10 * 60 * 1000) {
  const entry: Entry = { status, body, createdAt: Date.now(), ttlMs };
  const r = getRedis();
  if (!r) {
    store.set(key, entry);
    return;
  }
  await ensureRedisConnected();
  await r.set(`idem:${key}`, JSON.stringify(entry), 'PX', ttlMs);
}
