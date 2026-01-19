import { getGate } from './rateLimiter.js';
import * as T from './types.js';
import { z } from 'zod';

const PUBLIC_BASE = 'https://api.coin.z.com/public' as const;
const FOREX_PUBLIC_BASE = 'https://forex-api.coin.z.com/public' as const;
const V = '/v1' as const;
const FETCH_TIMEOUT = 30_000;

class PublicCache {
  private cache = new Map<string, { data: unknown; expiry: number }>();
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) return entry.data as T;
    return undefined;
  }
  set(key: string, data: unknown, ttlMs: number) {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }
}

export class PublicRestClient {
  protected cache = new PublicCache();

  constructor(protected baseUrl: string) {}

  protected async _get<TResp>(
    path: string,
    qs?: Record<string, string | undefined>,
    schema?: z.ZodSchema<any>,
  ): Promise<T.Result<TResp>> {
    await getGate.wait();
    const url = new URL(this.baseUrl + path);
    if (qs) {
      for (const [k, v] of Object.entries(qs)) {
        if (v != null) url.searchParams.set(k, v);
      }
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok || (json && json.status !== 0)) {
        return { success: false, error: new Error(`GET ${path} failed`) };
      }

      if (schema) {
        const envelope = T.ApiEnvelopeSchema(schema);
        const parsed = envelope.safeParse(json);
        if (!parsed.success) return { success: false, error: parsed.error };
        return { success: true, data: parsed.data.data as TResp };
      }

      return { success: true, data: json.data as TResp };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async getTicker(symbol: string): Promise<T.Result<T.Ticker>> {
    const cacheKey = `ticker:${symbol}`;
    const cached = this.cache.get<T.Ticker>(cacheKey);
    if (cached) return { success: true, data: cached };

    const result = await this._get<T.Ticker>(`${V}/ticker`, { symbol }, T.TickerSchema);
    if (result.success) this.cache.set(cacheKey, result.data, 1000);
    return result;
  }

  async getAllTickers(): Promise<T.Result<T.Ticker[]>> {
    return this._get<T.Ticker[]>(`${V}/ticker`, undefined, z.array(T.TickerSchema));
  }

  async getOrderBook(symbol: string, depth?: string): Promise<T.Result<any>> {
    return this._get(`${V}/orderbooks`, { symbol, depth });
  }

  async getTrades(symbol: string, count?: string): Promise<T.Result<any[]>> {
    return this._get(`${V}/trades`, { symbol, count });
  }

  async getKlines(symbol: string, interval: string, date?: string): Promise<T.Result<any[]>> {
    return this._get(`${V}/klines`, { symbol, interval, date });
  }
}

export class FxPublicRestClient extends PublicRestClient {
  constructor(baseUrl = FOREX_PUBLIC_BASE) {
    super(baseUrl);
  }
}

export class CryptoPublicRestClient extends PublicRestClient {
  constructor(baseUrl = PUBLIC_BASE) {
    super(baseUrl);
  }
}