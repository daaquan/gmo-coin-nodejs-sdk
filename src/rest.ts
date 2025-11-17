import { buildHeaders } from './auth.js';
import { getGate, postGate } from './rateLimiter.js';
import type * as T from './types.js';

interface ErrorResponse {
  status?: number;
  code?: string;
  message?: string;
  data?: {
    code?: string;
    message?: string;
  };
}

const FOREX_BASE = 'https://forex-api.coin.z.com/private';
const CRYPTO_BASE = 'https://api.coin.z.com/private';
const V = '/v1';
const FETCH_TIMEOUT = 30_000; // 30秒

function ensureExecFields(execType: T.ExecType, body: { limitPrice?: string; stopPrice?: string; oco?: { limitPrice: string; stopPrice: string } }) {
  if (execType === 'LIMIT' && !body.limitPrice) throw new Error('LIMIT requires limitPrice');
  if (execType === 'STOP' && !body.stopPrice) throw new Error('STOP requires stopPrice');
  if (execType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice)) throw new Error('OCO requires oco.limitPrice and oco.stopPrice');
}

async function parseJson(res: Response) {
  let json: Record<string, unknown> | undefined;
  try { json = await res.json(); } catch { json = undefined; }
  return json;
}

function errText(method: string, path: string, res: Response, json: Record<string, unknown> | undefined) {
  const statusLine = `${res.status} ${res.statusText}`;
  const err = json as ErrorResponse | undefined;
  const code = err?.data?.code || err?.code || err?.status;
  const msg = err?.data?.message || err?.message || '';
  return `${method} ${path} failed: ${statusLine} code=${code ?? 'n/a'} msg=${msg || JSON.stringify(json)}`;
}

/**
 * Base class for REST API clients
 * Handles common HTTP operations with rate limiting and error handling
 */
abstract class BaseRestClient {
  constructor(protected apiKey: string, protected secret: string, protected baseUrl: string) {
    if (!apiKey || !secret) {
      throw new Error(`${this.constructor.name}: Missing API credentials.`);
    }
  }

  protected async _get<TResp>(path: string, qs?: Record<string, string | undefined>): Promise<TResp> {
    await getGate.wait();
    const url = new URL(this.baseUrl + path);
    if (qs) for (const [k, v] of Object.entries(qs)) if (v != null) url.searchParams.set(k, v);
    const headers = buildHeaders(this.apiKey, this.secret, 'GET', path, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      const json = await parseJson(res);
      if (!res.ok || json?.status !== 0) throw new Error(errText('GET', path, res, json));
      return json as TResp;
    } finally {
      clearTimeout(timeout);
    }
  }

  protected async _post<TResp>(path: string, body: unknown): Promise<TResp> {
    await postGate.wait();
    const payload = JSON.stringify(body ?? {});
    const headers = buildHeaders(this.apiKey, this.secret, 'POST', path, payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(this.baseUrl + path, { method: 'POST', headers, body: payload, signal: controller.signal });
      const json = await parseJson(res);
      if (!res.ok || json?.status !== 0) throw new Error(errText('POST', path, res, json));
      return json as TResp;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class FxPrivateRestClient extends BaseRestClient {
  constructor(apiKey: string, secret: string, baseUrl = FOREX_BASE) {
    if (!apiKey || !secret) {
      throw new Error('FxPrivateRestClient: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.');
    }
    super(apiKey, secret, baseUrl);
  }

  /** ====== ACCOUNT ====== */
  getAssets() {
    return this._get<T.FxAssetResp>(`${V}/account/assets`);
  }

  /** ====== QUERIES ====== */
  getActiveOrders(q?: { symbol?: string; prevId?: string; count?: string }) {
    return this._get<T.FxActiveOrdersResp>(`${V}/activeOrders`, q);
  }
  getExecutions(q: { executionId: string }) {
    return this._get<T.FxExecutionsResp>(`${V}/executions`, q);
  }
  getLatestExecutions(q: { symbol: string; count?: string }) {
    return this._get<T.FxLatestExecsResp>(`${V}/latestExecutions`, q);
  }
  getOpenPositions(q?: { symbol?: string; prevId?: string; count?: string }) {
    return this._get<T.FxOpenPositionsResp>(`${V}/openPositions`, q);
  }
  getPositionSummary(q?: { symbol?: string }) {
    return this._get<T.FxPositionSummaryResp>(`${V}/positionSummary`, q);
  }

  /** ====== ORDERS ====== */
  speedOrder(body: T.FxSpeedOrderReq) {
    return this._post<T.FxSpeedOrderResp>(`${V}/speedOrder`, body);
  }
  placeOrder(body: T.FxOrderReq) {
    ensureExecFields(body.executionType, body);
    if (body.executionType === 'LIMIT' && !body.limitPrice) throw new Error('LIMIT order requires limitPrice');
    if (body.executionType === 'STOP' && !body.stopPrice) throw new Error('STOP order requires stopPrice');
    if (body.executionType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice)) throw new Error('OCO order requires oco.limitPrice and oco.stopPrice');
    return this._post<T.FxOrderResp>(`${V}/order`, body);
  }
  placeIfdOrder(body: T.FxIfdOrderReq) {
    ensureExecFields(body.firstExecutionType, { limitPrice: body.firstPrice, stopPrice: body.firstStopPrice });
    ensureExecFields(body.secondExecutionType, { limitPrice: body.secondPrice, stopPrice: body.secondStopPrice });
    return this._post<T.FxIfdOrderResp>(`${V}/ifdOrder`, body);
  }
  placeIfdocoOrder(body: T.FxIfdocoOrderReq) {
    ensureExecFields(body.firstExecutionType, { limitPrice: body.firstPrice, stopPrice: body.firstStopPrice });
    // OCO requires two prices (limit + stop)
    if (!body.secondLimitPrice || !body.secondStopPrice) throw new Error('IFDOCO requires secondLimitPrice and secondStopPrice');
    return this._post<T.FxIfdocoOrderResp>(`${V}/ifoOrder`, body);
  }
  changeOrder(body: T.FxChangeOrderReq) {
    return this._post<T.FxChangeOrderResp>(`${V}/changeOrder`, body);
  }
  changeIfdOrder(body: T.FxChangeIfdReq) {
    return this._post<T.FxChangeIfdResp>(`${V}/changeIfdOrder`, body);
  }
  changeIfdocoOrder(body: T.FxChangeIfdocoReq) {
    return this._post<T.FxChangeIfdocoResp>(`${V}/changeIfoOrder`, body);
  }
  cancelOrders(body: T.FxCancelOrdersReq) {
    return this._post<T.FxCancelOrdersResp>(`${V}/cancelOrders`, body);
  }
  cancelBulk(body: T.FxCancelBulkReq) {
    return this._post<T.FxCancelBulkResp>(`${V}/cancelBulkOrder`, body);
  }
  closeOrder(body: T.FxCloseOrderReq) {
    if (!body.settlePosition?.length) throw new Error('closeOrder requires at least one settlePosition');
    ensureExecFields(body.executionType, { limitPrice: body.limitPrice, stopPrice: body.stopPrice });
    return this._post<T.FxCloseOrderResp>(`${V}/closeOrder`, body);
  }
}

/**
 * GMO Coin Crypto API Private REST Client
 * Handles cryptocurrency trading on GMO Coin
 */
export class CryptoPrivateRestClient extends BaseRestClient {
  constructor(apiKey: string, secret: string, baseUrl = CRYPTO_BASE) {
    if (!apiKey || !secret) {
      throw new Error('CryptoPrivateRestClient: Missing API credentials. Set CRYPTO_API_KEY and CRYPTO_API_SECRET.');
    }
    super(apiKey, secret, baseUrl);
  }

  protected async _delete<TResp>(path: string): Promise<TResp> {
    await postGate.wait();
    const headers = buildHeaders(this.apiKey, this.secret, 'DELETE', path, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(this.baseUrl + path, { method: 'DELETE', headers, signal: controller.signal });
      const json = await parseJson(res);
      if (!res.ok || json?.status !== 0) throw new Error(errText('DELETE', path, res, json));
      return json as TResp;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** ====== ACCOUNT ====== */
  getAssets() {
    return this._get<T.CryptoAssetsResp>('/v1/account/assets');
  }

  /** ====== QUERIES ====== */
  getOpenPositions(q?: { symbol?: string; pageSize?: string }) {
    return this._get<T.CryptoOpenPositionsResp>('/v1/openPositions', q);
  }

  getActiveOrders(q?: { symbol?: string; pageSize?: string }) {
    return this._get<T.CryptoActiveOrdersResp>('/v1/activeOrders', q);
  }

  getExecutions(q?: { symbol?: string; orderId?: string; pageSize?: string }) {
    return this._get<T.CryptoExecutionsResp>('/v1/executions', q);
  }

  getLatestExecutions(q?: { symbol?: string; pageSize?: string }) {
    return this._get<T.CryptoLatestExecutionsResp>('/v1/latestExecutions', q);
  }

  getPositionSummary(q?: { symbol?: string }) {
    return this._get<T.CryptoPositionSummaryResp>('/v1/positionSummary', q);
  }

  /** ====== ORDERS ====== */
  placeOrder(body: T.CryptoOrderReq) {
    if (body.executionType === 'LIMIT' && !body.price) {
      throw new Error('LIMIT orders require price field');
    }
    if (body.executionType === 'STOP' && !body.losscutPrice) {
      throw new Error('STOP orders require losscutPrice field');
    }
    return this._post<T.CryptoOrderResp>('/v1/orders', body);
  }

  cancelOrder(orderId: string) {
    return this._delete<T.CryptoCancelOrderResp>(`/v1/orders/${orderId}`);
  }


  changeOrder(body: T.CryptoChangeOrderReq) {
    return this._post<T.CryptoChangeOrderResp>('/v1/changeOrder', body);
  }

  cancelOrders(body: T.CryptoCancelOrdersReq) {
    return this._post<T.CryptoCancelOrdersResp>('/v1/cancelOrders', body);
  }

  cancelBulk(body: T.CryptoCancelBulkReq) {
    return this._post<T.CryptoCancelBulkResp>('/v1/cancelBulkOrder', body);
  }

  /** ====== CLOSE POSITION ====== */
  async closePosition(symbol: string, size: string, side?: 'BUY' | 'SELL') {
    // Get current position to determine close side if not provided
    let closeSide = side;
    if (!closeSide) {
      const resp = await this.getOpenPositions({ symbol, pageSize: '1' });
      const positions = resp.data;
      if (!positions || positions.length === 0) {
        throw new Error(`No open position for ${symbol}`);
      }
      const position = positions[0];
      const currentSize = parseFloat(position.sumSize);
      closeSide = currentSize > 0 ? 'SELL' : 'BUY';
    }

    // Place market order to close
    return this.placeOrder({
      symbol,
      side: closeSide,
      executionType: 'MARKET',
      size: size,
      timeInForce: 'FAK',
    });
  }

  /** ====== SYMBOLS ====== */
  getSupportedSymbols(): string[] {
    return [
      'BTC',
      'ETH',
      'BCH',
      'LTC',
      'XRP',
      'XEM',
      'XLM',
      'BAT',
      'OMG',
      'XTZ',
      'QTUM',
      'ENJ',
      'DOT',
      'ATOM',
      'ADA',
      'MKR',
      'DAI',
      'LINK',
      'SOL',
      'MATIC',
      'AAVE',
      'UNI',
      'AVAX',
      'DOGE',
      'SHIB',
    ];
  }
}
