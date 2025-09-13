// Redis-backed per-verb limiter with fallback to in-process.
// Approach: fixed-window counter (1s). If over limit, wait until next window.
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getGate, postGate, wsGate } from '../../src/rateLimiter.js';
import { getRedis, ensureRedisConnected } from './redis.js';

async function takeWindow(key: string, limit: number) {
  const r = getRedis();
  if (!r) return false;
  await ensureRedisConnected();
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  const rk = `${key}:${sec}`;
  const n = await r.incr(rk);
  if (n === 1) {
    await r.expire(rk, 2); // 2s to be safe
  }
  if (n <= limit) return true;
  return false;
}

async function waitGate(key: string, limit: number, fallback: () => Promise<void>) {
  const r = getRedis();
  if (!r) return fallback();
  while (true) {
    const ok = await takeWindow(key, limit);
    if (ok) return;
    // sleep until next second boundary
    const ms = 1000 - (Date.now() % 1000);
    await new Promise((res) => setTimeout(res, ms));
  }
}

export async function gmoGetGate(_req: FastifyRequest, _reply: FastifyReply) {
  await waitGate('gmo:rl:get', 6, () => getGate.wait());
}
export async function gmoPostGate(_req: FastifyRequest, _reply: FastifyReply) {
  await waitGate('gmo:rl:post', 1, () => postGate.wait());
}
export async function gmoWsGate() {
  await waitGate('gmo:rl:ws', 1, () => wsGate.wait());
}
