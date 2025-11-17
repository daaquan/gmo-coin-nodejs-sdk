import { z } from 'zod';
import type * as T from './types.js';

/**
 * Validation schemas for GMO Coin API requests
 * Provides client-side validation before sending to API
 */

// ====== COMMON SCHEMAS ======

const SymbolSchema = z.string().min(1).max(20);
const SideSchema = z.enum(['BUY', 'SELL']);
const PriceSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid price format');
const SizeSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid size format');

// ====== FX SYMBOLS ======

const FxSymbols = [
  'USD_JPY', 'EUR_JPY', 'GBP_JPY', 'AUD_JPY', 'NZD_JPY',
  'CAD_JPY', 'CHF_JPY', 'ZAR_JPY', 'TRY_JPY', 'CNY_JPY',
  'HKD_JPY', 'SGD_JPY', 'INR_JPY', 'MXN_JPY', 'BRL_JPY',
  'EUR_USD', 'GBP_USD', 'AUD_USD',
] as const;

const FxSymbolSchema = z.enum(FxSymbols);

// ====== CRYPTO SYMBOLS ======

const CryptoSymbols = [
  'BTC', 'ETH', 'BCH', 'LTC', 'XRP', 'XEM', 'XLM', 'BAT', 'OMG',
  'XTZ', 'QTUM', 'ENJ', 'DOT', 'ATOM', 'ADA', 'MKR', 'DAI', 'LINK',
  'SOL', 'MATIC', 'AAVE', 'UNI', 'AVAX', 'DOGE', 'SHIB',
] as const;

const CryptoSymbolSchema = z.enum(CryptoSymbols);

// ====== FX VALIDATION SCHEMAS ======

/**
 * FX Order Request Validation
 * Validates symbol, side, execution type, and price/size fields
 */
export const FxOrderReqSchema = z.object({
  symbol: FxSymbolSchema,
  side: SideSchema,
  executionType: z.enum(['LIMIT', 'STOP', 'OCO']),
  size: SizeSchema,
  limitPrice: PriceSchema.optional(),
  stopPrice: PriceSchema.optional(),
  oco: z.object({
    limitPrice: PriceSchema,
    stopPrice: PriceSchema,
  }).optional(),
}).refine(
  (data) => {
    if (data.executionType === 'LIMIT' && !data.limitPrice) return false;
    if (data.executionType === 'STOP' && !data.stopPrice) return false;
    if (data.executionType === 'OCO' && !data.oco) return false;
    return true;
  },
  {
    message: 'Missing required price field for execution type',
  }
);

/**
 * FX IFD Order Validation
 */
export const FxIfdOrderReqSchema = z.object({
  symbol: FxSymbolSchema,
  side: SideSchema,
  size: SizeSchema,
  firstExecutionType: z.enum(['LIMIT', 'STOP', 'OCO']),
  firstPrice: PriceSchema.optional(),
  firstStopPrice: PriceSchema.optional(),
  secondExecutionType: z.enum(['LIMIT', 'STOP']),
  secondPrice: PriceSchema.optional(),
  secondStopPrice: PriceSchema.optional(),
}).refine(
  (data) => {
    if (data.firstExecutionType === 'LIMIT' && !data.firstPrice) return false;
    if (data.firstExecutionType === 'STOP' && !data.firstStopPrice) return false;
    if (data.secondExecutionType === 'LIMIT' && !data.secondPrice) return false;
    if (data.secondExecutionType === 'STOP' && !data.secondStopPrice) return false;
    return true;
  },
  {
    message: 'Missing required price fields for IFD order',
  }
);

/**
 * FX Close Order Validation
 */
export const FxCloseOrderReqSchema = z.object({
  symbol: FxSymbolSchema,
  side: SideSchema,
  executionType: z.enum(['LIMIT', 'STOP', 'OCO']),
  settlePosition: z.array(z.object({
    positionId: z.string().min(1),
    size: SizeSchema,
  })).min(1, 'At least one position must be provided'),
  limitPrice: PriceSchema.optional(),
  stopPrice: PriceSchema.optional(),
  oco: z.object({
    limitPrice: PriceSchema,
    stopPrice: PriceSchema,
  }).optional(),
});

// ====== CRYPTO VALIDATION SCHEMAS ======

/**
 * Crypto Order Request Validation
 */
export const CryptoOrderReqSchema = z.object({
  symbol: CryptoSymbolSchema,
  side: SideSchema,
  executionType: z.enum(['MARKET', 'LIMIT', 'STOP']),
  size: SizeSchema,
  price: PriceSchema.optional(),
  losscutPrice: PriceSchema.optional(),
  timeInForce: z.enum(['FAK', 'FAS', 'SOK']).optional(),
}).refine(
  (data) => {
    if (data.executionType === 'LIMIT' && !data.price) return false;
    if (data.executionType === 'STOP' && !data.losscutPrice) return false;
    return true;
  },
  {
    message: 'Missing required price field for execution type',
  }
);

// ====== PUBLIC API VALIDATION ======

/**
 * Ticker Request Validation
 */
export const TickerRequestSchema = z.object({
  symbol: SymbolSchema,
});

/**
 * OrderBook Request Validation
 */
export const OrderBookRequestSchema = z.object({
  symbol: SymbolSchema,
  depth: z.string().optional(),
});

/**
 * Klines Request Validation
 */
export const KlinesRequestSchema = z.object({
  symbol: SymbolSchema,
  interval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '1d', '1w', '1M']),
  count: z.string().optional(),
  before: z.string().optional(),
});

// ====== VALIDATION FUNCTIONS ======

/**
 * Validate and parse an FX order request
 * @throws ZodError if validation fails
 */
export function validateFxOrder(data: unknown): T.FxOrderReq {
  return FxOrderReqSchema.parse(data) as T.FxOrderReq;
}

/**
 * Validate and parse a Crypto order request
 * @throws ZodError if validation fails
 */
export function validateCryptoOrder(data: unknown): T.CryptoOrderReq {
  return CryptoOrderReqSchema.parse(data) as T.CryptoOrderReq;
}

/**
 * Validate symbol for FX trading
 */
export function validateFxSymbol(symbol: string): boolean {
  try {
    FxSymbolSchema.parse(symbol);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate symbol for Crypto trading
 */
export function validateCryptoSymbol(symbol: string): boolean {
  try {
    CryptoSymbolSchema.parse(symbol);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get supported FX symbols
 */
export function getFxSymbols(): readonly string[] {
  return FxSymbols;
}

/**
 * Get supported Crypto symbols
 */
export function getCryptoSymbols(): readonly string[] {
  return CryptoSymbols;
}

/**
 * Safe validation - returns error message instead of throwing
 */
export function validateFxOrderSafe(
  data: unknown
): { valid: true; data: T.FxOrderReq } | { valid: false; error: string } {
  try {
    return { valid: true, data: FxOrderReqSchema.parse(data) as T.FxOrderReq };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    return { valid: false, error: message };
  }
}

export function validateCryptoOrderSafe(
  data: unknown
): { valid: true; data: T.CryptoOrderReq } | { valid: false; error: string } {
  try {
    return { valid: true, data: CryptoOrderReqSchema.parse(data) as T.CryptoOrderReq };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    return { valid: false, error: message };
  }
}
