import { buildHeaders } from './auth.js';
import { getGate, postGate } from './rateLimiter.js';
import { auditLogger } from './audit.js';
import { metricsCollector } from './metrics.js';
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

function ensureExecFields(
  execType: T.ExecType,
  body: {
    limitPrice?: string;
    stopPrice?: string;
    oco?: { limitPrice: string; stopPrice: string };
  },
) {
  if (execType === 'LIMIT' && !body.limitPrice) throw new Error('LIMIT requires limitPrice');
  if (execType === 'STOP' && !body.stopPrice) throw new Error('STOP requires stopPrice');
  if (execType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice))
    throw new Error('OCO requires oco.limitPrice and oco.stopPrice');
}

async function parseJson(res: Response) {
  let json: Record<string, unknown> | undefined;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  return json;
}

function errText(
  method: string,
  path: string,
  res: Response,
  json: Record<string, unknown> | undefined,
) {
  const statusLine = `${res.status} ${res.statusText}`;
  const err = json as ErrorResponse | undefined;
  const code = err?.data?.code || err?.code || err?.status;
  const msg = err?.data?.message || err?.message || '';
  return `${method} ${path} failed: ${statusLine} code=${code ?? 'n/a'} msg=${msg || JSON.stringify(json)}`;
}

/**
 * Normalize pagination options for FX API (cursor-based: prevId + count)
 * Converts unified PaginationOptions to FX-specific parameters
 */
function normalizeFxPagination(opts?: T.PaginationOptions): Record<string, string | undefined> {
  if (!opts) return {};

  const result: Record<string, string | undefined> = {};

  // Cursor-based pagination (prevId + count)
  if (opts.prevId) result.prevId = opts.prevId;
  if (opts.count) result.count = opts.count;

  // Note: offset/limit are not supported in FX API
  // If user provides offset/limit, log warning but don't use them
  if (opts.offset || opts.limit) {
    console.warn('FX API does not support offset/limit pagination; use prevId + count instead');
  }

  return result;
}

/**
 * Normalize pagination options for Crypto API (pageSize or limit)
 * Converts unified PaginationOptions to Crypto-specific parameters
 * Supports both legacy pageSize and newer limit parameters
 */
function normalizeCryptoPagination(opts?: T.PaginationOptions): Record<string, string | undefined> {
  if (!opts) return {};

  const result: Record<string, string | undefined> = {};

  // Use limit if provided, otherwise fallback to pageSize (backward compat)
  if (opts.limit) {
    result.pageSize = opts.limit;
  } else if (opts.pageSize) {
    result.pageSize = opts.pageSize;
  }

  // Note: cursor-based pagination (prevId) not supported in Crypto API
  if (opts.prevId) {
    console.warn('Crypto API does not support cursor-based pagination; use pageSize/limit instead');
  }

  return result;
}

/**
 * Base class for REST API clients
 * Handles common HTTP operations with rate limiting and error handling
 */
abstract class BaseRestClient {
  constructor(
    protected apiKey: string,
    protected secret: string,
    protected baseUrl: string,
  ) {
    if (!apiKey || !secret) {
      throw new Error(`${this.constructor.name}: Missing API credentials.`);
    }
  }

  protected async _get<TResp>(
    path: string,
    qs?: Record<string, string | undefined>,
  ): Promise<TResp> {
    await getGate.wait();
    const url = new URL(this.baseUrl + path);
    if (qs) for (const [k, v] of Object.entries(qs)) if (v != null) url.searchParams.set(k, v);
    const headers = buildHeaders(this.apiKey, this.secret, 'GET', path, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const startTime = Date.now();

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      const json = await parseJson(res);

      const duration = Date.now() - startTime;
      const isError = !res.ok || json?.status !== 0;
      const errorMsg = isError ? errText('GET', path, res, json) : undefined;

      // Record metrics
      metricsCollector.recordRequest(
        'GET',
        path,
        res.status,
        duration,
        isError ? errorMsg : undefined,
      );

      // Record audit log
      auditLogger.log('GET', path, res.status, duration, {
        requestBody: undefined,
        responseData: json?.status === 0 ? undefined : json, // Log errors only
        error: errorMsg,
      });

      if (isError) throw new Error(errorMsg);
      return json as TResp;
    } catch (e) {
      const duration = Date.now() - startTime;

      // Record metrics for caught errors
      metricsCollector.recordRequest(
        'GET',
        path,
        0,
        duration,
        e instanceof Error ? e.message : String(e),
      );

      auditLogger.log('GET', path, 0, duration, {
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
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
    const startTime = Date.now();

    try {
      const res = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });
      const json = await parseJson(res);

      const duration = Date.now() - startTime;
      const isError = !res.ok || json?.status !== 0;
      const errorMsg = isError ? errText('POST', path, res, json) : undefined;

      // Record metrics
      metricsCollector.recordRequest(
        'POST',
        path,
        res.status,
        duration,
        isError ? errorMsg : undefined,
      );

      // Record audit log
      auditLogger.log('POST', path, res.status, duration, {
        requestBody: body, // Log request for POST operations
        responseData: json?.status === 0 ? undefined : json, // Log errors only
        error: errorMsg,
      });

      if (isError) throw new Error(errorMsg);
      return json as TResp;
    } catch (e) {
      const duration = Date.now() - startTime;

      // Record metrics for caught errors
      metricsCollector.recordRequest(
        'POST',
        path,
        0,
        duration,
        e instanceof Error ? e.message : String(e),
      );

      auditLogger.log('POST', path, 0, duration, {
        requestBody: body,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class FxPrivateRestClient extends BaseRestClient {
  constructor(apiKey: string, secret: string, baseUrl = FOREX_BASE) {
    if (!apiKey || !secret) {
      throw new Error(
        'FxPrivateRestClient: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.',
      );
    }
    super(apiKey, secret, baseUrl);
  }

  /** ====== ACCOUNT ====== */
  getAssets() {
    return this._get<T.FxAssetResp>(`${V}/account/assets`);
  }

  /** ====== QUERIES ====== */
  /**
   * Get active (pending) orders
   * Supports unified pagination: use prevId + count for cursor-based pagination
   */
  getActiveOrders(q?: { symbol?: string } & T.PaginationOptions) {
    const { symbol } = q || {};
    const pagination = normalizeFxPagination(q);
    const params = { symbol, ...pagination };
    return this._get<T.FxActiveOrdersResp>(`${V}/activeOrders`, params);
  }

  getExecutions(q: { executionId: string }) {
    return this._get<T.FxExecutionsResp>(`${V}/executions`, q);
  }

  getLatestExecutions(q: { symbol: string; count?: string }) {
    return this._get<T.FxLatestExecsResp>(`${V}/latestExecutions`, q);
  }

  /**
   * Get open positions
   * Supports unified pagination: use prevId + count for cursor-based pagination
   */
  getOpenPositions(q?: { symbol?: string } & T.PaginationOptions) {
    const { symbol } = q || {};
    const pagination = normalizeFxPagination(q);
    const params = { symbol, ...pagination };
    return this._get<T.FxOpenPositionsResp>(`${V}/openPositions`, params);
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
    if (body.executionType === 'LIMIT' && !body.limitPrice)
      throw new Error('LIMIT order requires limitPrice');
    if (body.executionType === 'STOP' && !body.stopPrice)
      throw new Error('STOP order requires stopPrice');
    if (body.executionType === 'OCO' && (!body.oco?.limitPrice || !body.oco?.stopPrice))
      throw new Error('OCO order requires oco.limitPrice and oco.stopPrice');
    return this._post<T.FxOrderResp>(`${V}/order`, body);
  }
  placeIfdOrder(body: T.FxIfdOrderReq) {
    ensureExecFields(body.firstExecutionType, {
      limitPrice: body.firstPrice,
      stopPrice: body.firstStopPrice,
    });
    ensureExecFields(body.secondExecutionType, {
      limitPrice: body.secondPrice,
      stopPrice: body.secondStopPrice,
    });
    return this._post<T.FxIfdOrderResp>(`${V}/ifdOrder`, body);
  }
  placeIfdocoOrder(body: T.FxIfdocoOrderReq) {
    ensureExecFields(body.firstExecutionType, {
      limitPrice: body.firstPrice,
      stopPrice: body.firstStopPrice,
    });
    // OCO requires two prices (limit + stop)
    if (!body.secondLimitPrice || !body.secondStopPrice)
      throw new Error('IFDOCO requires secondLimitPrice and secondStopPrice');
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
    if (!body.settlePosition?.length)
      throw new Error('closeOrder requires at least one settlePosition');
    ensureExecFields(body.executionType, {
      limitPrice: body.limitPrice,
      stopPrice: body.stopPrice,
    });
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
      throw new Error(
        'CryptoPrivateRestClient: Missing API credentials. Set CRYPTO_API_KEY and CRYPTO_API_SECRET.',
      );
    }
    super(apiKey, secret, baseUrl);
  }

  protected async _delete<TResp>(path: string): Promise<TResp> {
    await postGate.wait();
    const headers = buildHeaders(this.apiKey, this.secret, 'DELETE', path, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(this.baseUrl + path, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });
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
  /**
   * Get open positions
   * Supports unified pagination: use limit/pageSize for pagination
   */
  getOpenPositions(q?: { symbol?: string } & T.PaginationOptions) {
    const { symbol } = q || {};
    const pagination = normalizeCryptoPagination(q);
    const params = { symbol, ...pagination };
    return this._get<T.CryptoOpenPositionsResp>('/v1/openPositions', params);
  }

  /**
   * Get active (pending) orders
   * Supports unified pagination: use limit/pageSize for pagination
   */
  getActiveOrders(q?: { symbol?: string } & T.PaginationOptions) {
    const { symbol } = q || {};
    const pagination = normalizeCryptoPagination(q);
    const params = { symbol, ...pagination };
    return this._get<T.CryptoActiveOrdersResp>('/v1/activeOrders', params);
  }

  /**
   * Get executions (completed orders)
   * Supports unified pagination: use limit/pageSize for pagination
   */
  getExecutions(q?: { symbol?: string; orderId?: string } & T.PaginationOptions) {
    const { symbol, orderId } = q || {};
    const pagination = normalizeCryptoPagination(q);
    const params = { symbol, orderId, ...pagination };
    return this._get<T.CryptoExecutionsResp>('/v1/executions', params);
  }

  /**
   * Get latest executions
   * Supports unified pagination: use limit/pageSize for pagination
   */
  getLatestExecutions(q?: { symbol?: string } & T.PaginationOptions) {
    const { symbol } = q || {};
    const pagination = normalizeCryptoPagination(q);
    const params = { symbol, ...pagination };
    return this._get<T.CryptoLatestExecutionsResp>('/v1/latestExecutions', params);
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

  /**
   * Place OCO (One-Cancels-Other) order
   * Two legs: limit order and stop order, only one will execute
   */
  placeOcoOrder(body: T.CryptoOcoOrderReq) {
    if (!body.limitPrice) {
      throw new Error('OCO orders require limitPrice field');
    }
    if (!body.stopPrice) {
      throw new Error('OCO orders require stopPrice field');
    }
    return this._post<T.CryptoOcoOrderResp>('/v1/orders', body);
  }

  /**
   * Place IFD (If-Done) order
   * First leg must execute before second leg
   */
  placeIfdOrder(body: T.CryptoIfdOrderReq) {
    // Validate first leg
    if (body.firstExecutionType === 'LIMIT' && !body.firstPrice) {
      throw new Error('First leg LIMIT requires firstPrice field');
    }
    if (body.firstExecutionType === 'STOP' && !body.firstStopPrice) {
      throw new Error('First leg STOP requires firstStopPrice field');
    }

    // Validate second leg
    if (body.secondExecutionType === 'LIMIT' && !body.secondPrice) {
      throw new Error('Second leg LIMIT requires secondPrice field');
    }
    if (body.secondExecutionType === 'STOP' && !body.secondStopPrice) {
      throw new Error('Second leg STOP requires secondStopPrice field');
    }

    return this._post<T.CryptoIfdOrderResp>('/v1/orders', body);
  }

  /**
   * Place IFDOCO (If-Done with OCO) order
   * First leg entry order, second leg OCO (limit + stop)
   */
  placeIfdocoOrder(body: T.CryptoIfdocoOrderReq) {
    // Validate first leg
    if (body.firstExecutionType === 'LIMIT' && !body.firstPrice) {
      throw new Error('First leg LIMIT requires firstPrice field');
    }
    if (body.firstExecutionType === 'STOP' && !body.firstStopPrice) {
      throw new Error('First leg STOP requires firstStopPrice field');
    }

    // Validate second leg (OCO requires both limit and stop)
    if (!body.secondLimitPrice) {
      throw new Error('IFDOCO requires secondLimitPrice field');
    }
    if (!body.secondStopPrice) {
      throw new Error('IFDOCO requires secondStopPrice field');
    }

    return this._post<T.CryptoIfdocoOrderResp>('/v1/orders', body);
  }

  cancelOrder(orderId: string) {
    return this._delete<T.CryptoCancelOrderResp>(`/v1/orders/${orderId}`);
  }

  changeOrder(body: T.CryptoChangeOrderReq) {
    return this._post<T.CryptoChangeOrderResp>('/v1/changeOrder', body);
  }

  /**
   * Change OCO order prices
   */
  changeOcoOrder(body: T.CryptoChangeOcoOrderReq) {
    return this._post<T.CryptoChangeOcoOrderResp>('/v1/changeOrder', body);
  }

  /**
   * Change IFD order prices
   */
  changeIfdOrder(body: T.CryptoChangeIfdOrderReq) {
    return this._post<T.CryptoChangeIfdOrderResp>('/v1/changeOrder', body);
  }

  /**
   * Change IFDOCO order prices
   */
  changeIfdocoOrder(body: T.CryptoChangeIfdocoOrderReq) {
    return this._post<T.CryptoChangeIfdocoOrderResp>('/v1/changeOrder', body);
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
