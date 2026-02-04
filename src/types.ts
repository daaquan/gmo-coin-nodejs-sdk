import { z } from 'zod';

/**
 * Result pattern for type-safe error handling
 * Recommended by mastering-typescript skill
 */
export type Result<T, E = Error | z.ZodError> =
  | { success: true; data: T }
  | { success: false; error: E };

// ====== COMMON SCHEMAS & TYPES ======

export const SideSchema = z.enum(['BUY', 'SELL']);
export type Side = z.infer<typeof SideSchema>;

export const ExecTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'OCO']);
export type ExecType = z.infer<typeof ExecTypeSchema>;

export const SettleTypeSchema = z.enum(['OPEN', 'CLOSE']);
export type SettleType = z.infer<typeof SettleTypeSchema>;

export const PriceSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid price format');
export const SizeSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid size format');

/**
 * API Response Envelope
 */
export const ApiEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    status: z.number(), // 0 = success
    data: dataSchema,
    responsetime: z.string(), // ISO8601
  });

export type ApiEnvelope<T> = {
  status: number;
  data: T;
  responsetime: string;
};

// ====== SYMBOLS ======

export const FxSymbols = [
  'USD_JPY', 'EUR_JPY', 'GBP_JPY', 'AUD_JPY', 'NZD_JPY',
  'CAD_JPY', 'CHF_JPY', 'ZAR_JPY', 'TRY_JPY', 'CNY_JPY',
  'HKD_JPY', 'SGD_JPY', 'INR_JPY', 'MXN_JPY', 'BRL_JPY',
  'EUR_USD', 'GBP_USD', 'AUD_USD',
] as const;
export const FxSymbolSchema = z.enum(FxSymbols);
export type FxSymbol = z.infer<typeof FxSymbolSchema>;

export const CryptoSymbols = [
  'BTC', 'ETH', 'BCH', 'LTC', 'XRP', 'XEM', 'XLM', 'BAT', 'OMG',
  'XTZ', 'QTUM', 'ENJ', 'DOT', 'ATOM', 'ADA', 'MKR', 'DAI', 'LINK',
  'SOL', 'MATIC', 'AAVE', 'UNI', 'AVAX', 'DOGE', 'SHIB',
] as const;
export const CryptoSymbolSchema = z.enum(CryptoSymbols);
export type CryptoSymbol = z.infer<typeof CryptoSymbolSchema>;

// ====== FX DATA SCHEMAS ======

export const FxAssetSchema = z.object({
  equity: z.string(),
  availableAmount: z.string(),
  balance: z.string(),
  estimatedTradeFee: z.string(),
  margin: z.string(),
  marginRatio: z.string(),
  positionLossGain: z.string(),
  totalSwap: z.string(),
  transferableAmount: z.string(),
});
export type FxAsset = z.infer<typeof FxAssetSchema>;

export const FxActiveOrderSchema = z.object({
  rootOrderId: z.number(),
  clientOrderId: z.string().optional(),
  orderId: z.number(),
  symbol: z.string(),
  side: SideSchema,
  orderType: z.enum(['NORMAL', 'IFD', 'OCO', 'IFDOCO']),
  executionType: ExecTypeSchema,
  settleType: SettleTypeSchema,
  size: z.string(),
  price: z.string().optional(),
  status: z.enum(['WAITING', 'ORDERED', 'MODIFYING', 'EXECUTED', 'EXPIRED']),
  cancelType: z.enum(['PRICE_BOUND', 'OCO']).optional(),
  expiry: z.string().optional(),
  timestamp: z.string(),
});
export type FxActiveOrder = z.infer<typeof FxActiveOrderSchema>;

export const FxExecutionSchema = z.object({
  executionId: z.string(),
  orderId: z.string(),
  symbol: z.string(),
  side: SideSchema,
  price: z.string(),
  size: z.string(),
  timestamp: z.string(),
});
export type FxExecution = z.infer<typeof FxExecutionSchema>;

// FX position summary shape differs between endpoints/accounts.
// Observed variants:
// - { symbol, side, size, price }
// - { symbol, side, sumSize, avgPrice }
// Normalize to { symbol, side, size, price }.
export const FxPositionSummarySchema = z
  .object({
    symbol: z.string(),
    side: SideSchema,
    size: z.string().optional(),
    price: z.string().optional(),
    sumSize: z.string().optional(),
    avgPrice: z.string().optional(),
  })
  .transform((x) => ({
    symbol: x.symbol,
    side: x.side,
    size: x.size ?? x.sumSize,
    price: x.price ?? x.avgPrice,
  }))
  .refine((x) => !!x.size && !!x.price, { message: 'Missing size/price fields in positionSummary item' });
export type FxPositionSummary = z.infer<typeof FxPositionSummarySchema>;

// ====== CRYPTO DATA SCHEMAS ======

export const CryptoAssetSchema = z.object({
  symbol: z.string(),
  amount: z.string(),
  available: z.string(),
});
export type CryptoAsset = z.infer<typeof CryptoAssetSchema>;

export const CryptoOpenPositionSchema = z.object({
  symbol: z.string(),
  sumSize: z.string(),
  avgPrice: z.string(),
  sumPrice: z.string(),
  side: SideSchema.optional(),
});
export type CryptoOpenPosition = z.infer<typeof CryptoOpenPositionSchema>;

export const CryptoActiveOrderSchema = z.object({
  rootOrderId: z.string(),
  orderId: z.string(),
  symbol: z.string(),
  side: SideSchema,
  executionType: ExecTypeSchema,
  size: z.string(),
  price: z.string().optional(),
  losscutPrice: z.string().optional(),
  status: z.enum(['WAITING', 'ORDERED', 'EXECUTED', 'EXPIRED']),
  timestamp: z.string(),
});
export type CryptoActiveOrder = z.infer<typeof CryptoActiveOrderSchema>;

// ====== PUBLIC DATA SCHEMAS ======

export const TickerSchema = z.object({
  symbol: z.string(),
  bid: z.string(),
  ask: z.string(),
  high: z.string(),
  low: z.string(),
  volume: z.string(),
  timestamp: z.string(),
});
export type Ticker = z.infer<typeof TickerSchema>;

// ====== PAGINATION ======

export const PaginationOptionsSchema = z.object({
  prevId: z.string().optional(),
  offset: z.string().optional(),
  limit: z.string().optional(),
  pageSize: z.string().optional(), // Deprecated
  count: z.string().optional(),
});
export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;
