/**
 * Type-safe mock helpers for GMO Coin SDK tests
 */
import { vi } from 'vitest';
import type * as T from '../../src/types.js';

// ====== API Envelope Mocks ======

/**
 * Create a type-safe API envelope mock
 */
export function createMockEnvelope<TData>(data: TData, status = 0): T.ApiEnvelope<TData> {
  return {
    status,
    data,
    responsetime: new Date().toISOString(),
  };
}

/**
 * Create an error API envelope
 */
export function createErrorEnvelope(
  code: string,
  message: string,
): T.ApiEnvelope<{ code: string; message: string }> {
  return {
    status: 1,
    data: { code, message },
    responsetime: new Date().toISOString(),
  };
}

// ====== Fastify Mocks ======

export interface MockFastifyRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
  id: string;
  server: {
    log: {
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };
  };
}

export interface MockFastifyReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  code: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Fastify request
 */
export function createMockRequest(overrides: Partial<MockFastifyRequest> = {}): MockFastifyRequest {
  return {
    headers: {},
    query: {},
    id: `req-${Date.now()}`,
    server: {
      log: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    },
    ...overrides,
  };
}

/**
 * Create a mock Fastify reply
 */
export function createMockReply(): MockFastifyReply {
  const reply: MockFastifyReply = {
    status: vi.fn(),
    send: vi.fn(),
    code: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  reply.code.mockReturnValue(reply);
  return reply;
}

// ====== Redis Mocks ======

export interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  status: 'wait' | 'ready' | 'end' | 'connecting';
  connect: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Redis client
 */
export function createMockRedis(status: MockRedis['status'] = 'ready'): MockRedis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    status,
    connect: vi.fn().mockResolvedValue(undefined),
  };
}

// ====== Idempotency Mocks ======

export interface IdempotencyEntry {
  status: number;
  body: unknown;
  createdAt: number;
  ttlMs: number;
}

/**
 * Create a mock idempotency entry
 */
export function createMockEntry(
  status = 200,
  body: unknown = { result: 'ok' },
  ttlMs = 600000,
): IdempotencyEntry {
  return {
    status,
    body,
    createdAt: Date.now(),
    ttlMs,
  };
}

/**
 * Create an expired idempotency entry
 */
export function createExpiredEntry(body: unknown = { result: 'expired' }): IdempotencyEntry {
  return {
    status: 200,
    body,
    createdAt: Date.now() - 700000, // 11+ minutes ago
    ttlMs: 600000, // 10 minute TTL
  };
}

// ====== Order Request Mocks ======

/**
 * Create a valid FX LIMIT order request
 */
export function createFxLimitOrder(symbol: string = 'USD_JPY', side: T.Side = 'BUY'): T.FxOrderReq {
  return {
    symbol,
    side,
    executionType: 'LIMIT' as const,
    size: '10000',
    limitPrice: '150.00',
  };
}

/**
 * Create a valid FX STOP order request
 */
export function createFxStopOrder(symbol: string = 'USD_JPY', side: T.Side = 'SELL'): T.FxOrderReq {
  return {
    symbol,
    side,
    executionType: 'STOP' as const,
    size: '10000',
    stopPrice: '148.00',
  };
}

/**
 * Create a valid FX OCO order request
 */
export function createFxOcoOrder(symbol: string = 'USD_JPY', side: T.Side = 'BUY'): T.FxOrderReq {
  return {
    symbol,
    side,
    executionType: 'OCO' as const,
    size: '10000',
    oco: {
      limitPrice: '152.00',
      stopPrice: '148.00',
    },
  };
}

/**
 * Create a valid Crypto MARKET order request
 */
export function createCryptoMarketOrder(
  symbol: string = 'BTC',
  side: T.Side = 'BUY',
): T.CryptoOrderReq {
  return {
    symbol,
    side,
    executionType: 'MARKET' as const,
    size: '0.01',
  };
}

/**
 * Create a valid Crypto LIMIT order request
 */
export function createCryptoLimitOrder(
  symbol: string = 'BTC',
  side: T.Side = 'BUY',
): T.CryptoOrderReq {
  return {
    symbol,
    side,
    executionType: 'LIMIT' as const,
    size: '0.01',
    price: '5000000',
  };
}

/**
 * Create a valid Crypto STOP order request
 */
export function createCryptoStopOrder(
  symbol: string = 'BTC',
  side: T.Side = 'SELL',
): T.CryptoOrderReq {
  return {
    symbol,
    side,
    executionType: 'STOP' as const,
    size: '0.01',
    losscutPrice: '4500000',
  };
}

// ====== Symbol Lists ======

export const FX_SYMBOLS = [
  'USD_JPY',
  'EUR_JPY',
  'GBP_JPY',
  'AUD_JPY',
  'NZD_JPY',
  'CAD_JPY',
  'CHF_JPY',
  'ZAR_JPY',
  'TRY_JPY',
  'CNY_JPY',
  'HKD_JPY',
  'SGD_JPY',
  'INR_JPY',
  'MXN_JPY',
  'BRL_JPY',
  'EUR_USD',
  'GBP_USD',
  'AUD_USD',
] as const;

export const CRYPTO_SYMBOLS = [
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
] as const;

export const KLINE_INTERVALS = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '8h',
  '12h',
  '1d',
  '1w',
  '1M',
] as const;

export type FxSymbol = (typeof FX_SYMBOLS)[number];
export type CryptoSymbol = (typeof CRYPTO_SYMBOLS)[number];
export type KlineInterval = (typeof KLINE_INTERVALS)[number];
