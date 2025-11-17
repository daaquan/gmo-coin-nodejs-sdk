import { getGate } from './rateLimiter.js';
import type * as T from './types.js';

const FOREX_PUBLIC_BASE = 'https://forex-api.coin.z.com/public';
const CRYPTO_PUBLIC_BASE = 'https://api.coin.z.com/public';
const V = '/v1';
const FETCH_TIMEOUT = 30_000; // 30秒

async function parseJson(res: Response) {
  let json: Record<string, unknown> | undefined;
  try { json = await res.json(); } catch { json = undefined; }
  return json;
}

function errText(method: string, path: string, res: Response, json: Record<string, unknown> | undefined) {
  const statusLine = `${res.status} ${res.statusText}`;
  return `${method} ${path} failed: ${statusLine} data=${JSON.stringify(json)}`;
}

/**
 * Base class for public REST API clients
 * No authentication required - rate limiting applies
 */
abstract class BasePublicRestClient {
  constructor(protected baseUrl: string) {}

  protected async _get<TResp>(path: string, qs?: Record<string, string | undefined>): Promise<TResp> {
    await getGate.wait();
    const url = new URL(this.baseUrl + path);
    if (qs) for (const [k, v] of Object.entries(qs)) if (v != null) url.searchParams.set(k, v);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const json = await parseJson(res);
      if (!res.ok) throw new Error(errText('GET', path, res, json));
      return json as TResp;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * GMO Coin Forex Public API Client
 * Provides market data without authentication
 */
export class FxPublicRestClient extends BasePublicRestClient {
  constructor(baseUrl = FOREX_PUBLIC_BASE) {
    super(baseUrl);
  }

  /**
   * Get latest ticker information
   * @param symbol Forex symbol (e.g., USD_JPY, EUR_JPY)
   */
  async getTicker(symbol: string): Promise<T.TickerResp> {
    return this._get<T.TickerResp>(`${V}/ticker`, { symbol });
  }

  /**
   * Get all tickers (multiple symbols)
   */
  async getAllTickers(): Promise<T.TickerResp[]> {
    const res = await this._get<T.AllTickersResp>(`${V}/ticker`);
    return (res as any).data || [];
  }

  /**
   * Get order book (depth)
   * @param symbol Forex symbol
   * @param depth Order book depth (default: 20)
   */
  async getOrderBook(symbol: string, depth?: string): Promise<T.OrderBookResp> {
    return this._get<T.OrderBookResp>(`${V}/orderbooks`, { symbol, depth });
  }

  /**
   * Get latest trades
   * @param symbol Forex symbol
   * @param count Number of trades (default: 100, max: 1000)
   */
  async getTrades(symbol: string, count?: string): Promise<T.TradesResp> {
    return this._get<T.TradesResp>(`${V}/trades`, { symbol, count });
  }

  /**
   * Get OHLCV candlestick data (klines)
   * @param symbol Forex symbol
   * @param interval Interval (1m, 5m, 15m, 30m, 1h, 4h, 8h, 12h, 1d, 1w, 1M)
   * @param count Number of candles (default: 100, max: 1440)
   * @param before Unix timestamp (ms) to get candles before this
   */
  async getKlines(
    symbol: string,
    interval: string,
    options?: { count?: string; before?: string }
  ): Promise<T.KlinesResp> {
    return this._get<T.KlinesResp>(`${V}/klines`, {
      symbol,
      interval,
      count: options?.count,
      before: options?.before,
    });
  }

  /**
   * Get supported symbols for Forex trading
   */
  getSupportedSymbols(): string[] {
    return [
      'USD_JPY', 'EUR_JPY', 'GBP_JPY', 'AUD_JPY', 'NZD_JPY',
      'CAD_JPY', 'CHF_JPY', 'ZAR_JPY', 'TRY_JPY', 'CNY_JPY',
      'HKD_JPY', 'SGD_JPY', 'INR_JPY', 'MXN_JPY', 'BRL_JPY',
      'EUR_USD', 'GBP_USD', 'AUD_USD',
    ];
  }
}

/**
 * GMO Coin Crypto Public API Client
 * Provides market data for cryptocurrencies without authentication
 */
export class CryptoPublicRestClient extends BasePublicRestClient {
  constructor(baseUrl = CRYPTO_PUBLIC_BASE) {
    super(baseUrl);
  }

  /**
   * Get latest ticker information
   * @param symbol Cryptocurrency symbol (e.g., BTC, ETH)
   */
  async getTicker(symbol: string): Promise<T.TickerResp> {
    return this._get<T.TickerResp>(`${V}/ticker`, { symbol });
  }

  /**
   * Get all tickers (multiple symbols)
   */
  async getAllTickers(): Promise<T.TickerResp[]> {
    const res = await this._get<T.AllTickersResp>(`${V}/ticker`);
    return (res as any).data || [];
  }

  /**
   * Get order book (depth)
   * @param symbol Cryptocurrency symbol
   * @param depth Order book depth (default: 20)
   */
  async getOrderBook(symbol: string, depth?: string): Promise<T.OrderBookResp> {
    return this._get<T.OrderBookResp>(`${V}/orderbooks`, { symbol, depth });
  }

  /**
   * Get latest trades
   * @param symbol Cryptocurrency symbol
   * @param count Number of trades (default: 100, max: 1000)
   */
  async getTrades(symbol: string, count?: string): Promise<T.TradesResp> {
    return this._get<T.TradesResp>(`${V}/trades`, { symbol, count });
  }

  /**
   * Get OHLCV candlestick data (klines)
   * @param symbol Cryptocurrency symbol
   * @param interval Interval (1m, 5m, 15m, 30m, 1h, 4h, 8h, 12h, 1d, 1w, 1M)
   * @param count Number of candles (default: 100, max: 1440)
   * @param before Unix timestamp (ms) to get candles before this
   */
  async getKlines(
    symbol: string,
    interval: string,
    options?: { count?: string; before?: string }
  ): Promise<T.KlinesResp> {
    return this._get<T.KlinesResp>(`${V}/klines`, {
      symbol,
      interval,
      count: options?.count,
      before: options?.before,
    });
  }

  /**
   * Get supported symbols for Crypto trading
   */
  getSupportedSymbols(): string[] {
    return [
      'BTC', 'ETH', 'BCH', 'LTC', 'XRP', 'XEM', 'XLM', 'BAT', 'OMG',
      'XTZ', 'QTUM', 'ENJ', 'DOT', 'ATOM', 'ADA', 'MKR', 'DAI', 'LINK',
      'SOL', 'MATIC', 'AAVE', 'UNI', 'AVAX', 'DOGE', 'SHIB',
    ];
  }
}
