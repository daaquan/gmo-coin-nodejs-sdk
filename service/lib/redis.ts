import { Redis } from 'ioredis';

let client: Redis | undefined;

export function getRedis(): Redis | undefined {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
  return client;
}

export async function ensureRedisConnected() {
  const r = getRedis();
  if (!r) return;
  if (r.status === 'wait' || r.status === 'end') {
    await r.connect();
  }
}

