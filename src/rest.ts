import { buildHeaders } from './auth.js';
import { getGate, postGate } from './rateLimiter.js';
import { auditLogger } from './audit.js';
import { metricsCollector } from './metrics.js';
import * as T from './types.js';
import { z } from 'zod';

const FOREX_BASE = 'https://forex-api.coin.z.com/private' as const;
const CRYPTO_BASE = 'https://api.coin.z.com/private' as const;
const V = '/v1' as const;
const FETCH_TIMEOUT = 30_000;

async function parseJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function errText(
  method: string,
  path: string,
  res: Response,
  json: Record<string, unknown> | null,
): string {
  const statusLine = `${res.status} ${res.statusText}`;
  const data = json?.data as { code?: string; message?: string } | undefined;
  const code = data?.code || (json?.code as string) || String(res.status);
  const msg = data?.message || (json?.message as string) || '';
  return `${method} ${path} failed: ${statusLine} code=${code} msg=${msg || JSON.stringify(json)}`;
}

abstract class BaseRestClient {
  constructor(
    protected apiKey: string,
    protected secret: string,
    protected baseUrl: string,
  ) {}

  protected async _request<TResp>(
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    path: string,
    options: {
      qs?: Record<string, string | undefined>;
      body?: unknown;
      schema?: z.ZodSchema<any>;
    } = {},
  ): Promise<T.Result<TResp>> {
    const { qs, body, schema } = options;
    const gate = method === 'GET' ? getGate : postGate;
    await gate.wait();

    const url = new URL(this.baseUrl + path);
    if (qs) {
      for (const [k, v] of Object.entries(qs)) {
        if (v != null) url.searchParams.set(k, v);
      }
    }

    const payload = body ? JSON.stringify(body) : null;
    const headers = buildHeaders(this.apiKey, this.secret, method, path, payload ?? '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const startTime = Date.now();

    try {
      const fetchOptions: any = {
        method,
        headers,
        signal: controller.signal,
      };
      if (payload !== null) fetchOptions.body = payload;

      const res = await fetch(url, fetchOptions);
      const json = await parseJson(res);
      const duration = Date.now() - startTime;
      const isError = !res.ok || (json && json.status !== 0);
      const errorMsg = isError ? errText(method, path, res, json) : null;

      metricsCollector.recordRequest(method, path, res.status, duration, errorMsg ?? undefined);
      
      const auditOptions: any = { requestBody: body };
      if (isError) auditOptions.responseData = json;
      if (errorMsg) auditOptions.error = errorMsg;
      auditLogger.log(method, path, res.status, duration, auditOptions);

      if (isError || !json) {
        return { success: false, error: new Error(errorMsg ?? 'Unknown error') };
      }

      if (schema) {
        const envelope = T.ApiEnvelopeSchema(schema);
        const parsed = envelope.safeParse(json);
        if (!parsed.success) return { success: false, error: parsed.error };
        return { success: true, data: parsed.data.data as TResp };
      }

      return { success: true, data: json.data as TResp };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return { success: false, error };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class FxPrivateRestClient extends BaseRestClient {
  constructor(apiKey: string, secret: string, baseUrl = FOREX_BASE) {
    super(apiKey, secret, baseUrl);
  }

  getAssets() {
    return this._request<T.FxAsset>('GET', `${V}/account/assets`, { schema: T.FxAssetSchema });
  }

  getActiveOrders(q?: { symbol?: string } & T.PaginationOptions) {
    const opts: any = { schema: z.array(T.FxActiveOrderSchema) };
    if (q) opts.qs = q;
    return this._request<T.FxActiveOrder[]>('GET', `${V}/activeOrders`, opts);
  }

  getExecutions(q: { executionId: string }) {
    return this._request<T.FxExecution[]>('GET', `${V}/executions`, { qs: q });
  }

  getLatestExecutions(q: { symbol: string; count?: string }) {
    return this._request<T.FxExecution[]>('GET', `${V}/latestExecutions`, { qs: q });
  }

  getOpenPositions(q?: { symbol?: string } & T.PaginationOptions) {
    const opts: any = {};
    if (q) opts.qs = q;
    return this._request<any[]>('GET', `${V}/openPositions`, opts);
  }

  getPositionSummary(q?: { symbol?: string }) {
    const opts: any = { schema: z.array(T.FxPositionSummarySchema) };
    if (q) opts.qs = q;
    return this._request<T.FxPositionSummary[]>('GET', `${V}/positionSummary`, opts);
  }

  placeOrder(body: unknown) {
    return this._request<any>('POST', `${V}/order`, { body });
  }

  speedOrder(body: unknown) {
    return this._request<any>('POST', `${V}/speedOrder`, { body });
  }

  placeIfdOrder(body: unknown) {
    return this._request<any>('POST', `${V}/ifdOrder`, { body });
  }

  placeIfdocoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/ifoOrder`, { body });
  }

  changeOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeOrder`, { body });
  }

  changeIfdOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeIfdOrder`, { body });
  }

  changeIfdocoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeIfoOrder`, { body });
  }

  cancelOrders(body: { rootOrderIds: number[] }) {
    return this._request<any>('POST', `${V}/cancelOrders`, { body });
  }

  cancelBulk(body: unknown) {
    return this._request<any>('POST', `${V}/cancelBulkOrder`, { body });
  }

  closeOrder(body: unknown) {
    return this._request<any>('POST', `${V}/closeOrder`, { body });
  }
}

export class CryptoPrivateRestClient extends BaseRestClient {
  constructor(apiKey: string, secret: string, baseUrl = CRYPTO_BASE) {
    super(apiKey, secret, baseUrl);
  }

  getAssets() {
    return this._request<T.CryptoAsset[]>('GET', `${V}/account/assets`, {
      schema: z.array(T.CryptoAssetSchema),
    });
  }

  getOpenPositions(q?: { symbol?: string } & T.PaginationOptions) {
    const opts: any = { schema: z.array(T.CryptoOpenPositionSchema) };
    if (q) opts.qs = q;
    return this._request<T.CryptoOpenPosition[]>('GET', `${V}/openPositions`, opts);
  }

  getActiveOrders(q?: { symbol?: string } & T.PaginationOptions) {
    const opts: any = { schema: z.array(T.CryptoActiveOrderSchema) };
    if (q) opts.qs = q;
    return this._request<T.CryptoActiveOrder[]>('GET', `${V}/activeOrders`, opts);
  }

  getExecutions(q?: Record<string, string | undefined>) {
    const opts: any = {};
    if (q) opts.qs = q;
    return this._request<any[]>('GET', `${V}/executions`, opts);
  }

  getLatestExecutions(q?: Record<string, string | undefined>) {
    const opts: any = {};
    if (q) opts.qs = q;
    return this._request<any[]>('GET', `${V}/latestExecutions`, opts);
  }

  getPositionSummary(q?: { symbol?: string }) {
    const opts: any = {};
    if (q) opts.qs = q;
    return this._request<any[]>('GET', `${V}/positionSummary`, opts);
  }

  placeOrder(body: unknown) {
    return this._request<any>('POST', `${V}/orders`, { body });
  }

  placeOcoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/orders`, { body });
  }

  placeIfdOrder(body: unknown) {
    return this._request<any>('POST', `${V}/orders`, { body });
  }

  placeIfdocoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/orders`, { body });
  }

  cancelOrder(orderId: string) {
    return this._request<any>('DELETE', `${V}/orders/${orderId}`);
  }

  changeOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeOrder`, { body });
  }

  changeOcoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeOrder`, { body });
  }

  changeIfdOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeOrder`, { body });
  }

  changeIfdocoOrder(body: unknown) {
    return this._request<any>('POST', `${V}/changeOrder`, { body });
  }

  cancelOrders(body: { rootOrderIds: string[] }) {
    return this._request<any>('POST', `${V}/cancelOrders`, { body });
  }

  cancelBulk(body: unknown) {
    return this._request<any>('POST', `${V}/cancelBulkOrder`, { body });
  }

  async closePosition(symbol: string, size: string, side?: 'BUY' | 'SELL') {
    let closeSide = side;
    if (!closeSide) {
      const resp = await this.getOpenPositions({ symbol });
      if (!resp.success || !resp.data[0]) throw new Error(`No open position for ${symbol}`);
      const currentSize = parseFloat(resp.data[0].sumSize);
      closeSide = currentSize > 0 ? 'SELL' : 'BUY';
    }
    return this.placeOrder({ symbol, side: closeSide, executionType: 'MARKET', size, timeInForce: 'FAK' });
  }

  getSupportedSymbols(): string[] {
    return [...T.CryptoSymbols];
  }
}
