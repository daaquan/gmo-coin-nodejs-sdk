import { z } from 'zod';
import * as T from './types.js';

// ====== FX VALIDATION SCHEMAS ======

export const FxOrderReqSchema = z
  .object({
    symbol: T.FxSymbolSchema,
    side: T.SideSchema,
    executionType: T.ExecTypeSchema,
    size: T.SizeSchema,
    limitPrice: T.PriceSchema.optional(),
    stopPrice: T.PriceSchema.optional(),
    oco: z
      .object({
        limitPrice: T.PriceSchema,
        stopPrice: T.PriceSchema,
      })
      .optional(),
    clientOrderId: z.string().optional(),
    expireDate: z.string().optional(),
    settleType: T.SettleTypeSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.executionType === 'LIMIT' && !data.limitPrice) return false;
      if (data.executionType === 'STOP' && !data.stopPrice) return false;
      if (data.executionType === 'OCO' && !data.oco) return false;
      return true;
    },
    { message: 'Missing required price field for execution type' },
  );

// ====== IFD / IFO (IFD-OCO) VALIDATION ======
// NOTE: GMO FX has dedicated endpoints (/v1/ifdOrder, /v1/ifoOrder).
// We keep this schema intentionally strict but minimal: it matches the most
// common documented fields for IFO (entry + take-profit/stop-loss as OCO).
// If GMO changes/extends fields, add them explicitly rather than using z.any()
// to preserve fail-closed behavior.
export const FxIfoOrderReqSchema = z
  .object({
    symbol: T.FxSymbolSchema,
    side: T.SideSchema,

    // Entry order (typically LIMIT)
    executionType: z.enum(['LIMIT', 'STOP']).default('LIMIT'),
    price: T.PriceSchema,

    size: T.SizeSchema,

    // After-entry OCO legs
    takeProfitPrice: T.PriceSchema,
    stopLossPrice: T.PriceSchema,

    // Optional
    clientOrderId: z.string().optional(),
    expireDate: z.string().optional(), // e.g. "20260210" (exchange-specific)
    timeInForce: z.enum(['FAS', 'FOK', 'FAK', 'SOK']).optional(),
  })
  .strict();

// Aliases for compatibility
export const FxIfdOrderReqSchema = z
  .object({
    symbol: T.FxSymbolSchema,
    side: T.SideSchema,
    size: T.SizeSchema,
    firstExecutionType: z.enum(['LIMIT', 'STOP']),
    firstPrice: T.PriceSchema.optional(),
    firstStopPrice: T.PriceSchema.optional(),
    secondExecutionType: z.enum(['LIMIT', 'STOP']),
    secondPrice: T.PriceSchema.optional(),
    secondStopPrice: T.PriceSchema.optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (data.firstExecutionType === 'LIMIT' && !data.firstPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstPrice'], message: 'Missing firstPrice' });
    }
    if (data.firstExecutionType === 'STOP' && !data.firstStopPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstStopPrice'], message: 'Missing firstStopPrice' });
    }
    if (data.secondExecutionType === 'LIMIT' && !data.secondPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondPrice'], message: 'Missing secondPrice' });
    }
    if (data.secondExecutionType === 'STOP' && !data.secondStopPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondStopPrice'], message: 'Missing secondStopPrice' });
    }
  });
export const FxCloseOrderReqSchema = z
  .object({
    symbol: T.FxSymbolSchema,
    side: T.SideSchema,
    executionType: z.enum(['MARKET', 'LIMIT', 'STOP']),
    size: T.SizeSchema.optional(),
    limitPrice: T.PriceSchema.optional(),
    stopPrice: T.PriceSchema.optional(),
    settlePosition: z.array(z.object({
      positionId: z.union([z.string().min(1), z.number()]),
      size: T.SizeSchema,
    })).min(1),
  })
  .passthrough();
const CryptoOrderSymbolSchema = z.union([T.CryptoSymbolSchema, T.CryptoTradingSymbolSchema]);

export const CryptoOrderReqSchema = z
  .object({
    symbol: CryptoOrderSymbolSchema,
    side: T.SideSchema,
    executionType: z.enum(['MARKET', 'LIMIT', 'STOP']),
    size: T.SizeSchema,
    price: T.PriceSchema.optional(),
    losscutPrice: T.PriceSchema.optional(),
    timeInForce: z.enum(['FAS', 'FAK', 'FOK', 'SOK']).optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (data.executionType === 'LIMIT' && !data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Missing required price field: LIMIT orders require price field',
      });
    }
    if (data.executionType === 'STOP' && !data.losscutPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['losscutPrice'],
        message: 'Missing required losscutPrice field: STOP orders require losscutPrice field',
      });
    }
  });
export const TickerRequestSchema = z.object({
  symbol: z.string().min(1).max(20),
});
export const OrderBookRequestSchema = z.object({
  symbol: z.string().min(1).max(20),
  depth: z.string().regex(/^\d+$/).optional(),
});
export const KlinesRequestSchema = z.object({
  symbol: z.string().min(1).max(20),
  interval: z.enum([
    '1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '1d', '1w', '1M',
    '1min', '5min', '10min', '15min', '30min', '1hour', '4hour', '8hour',
    '12hour', '1day', '1week', '1month',
  ]),
  date: z.string().optional(),
  count: z.string().regex(/^\d+$/).optional(),
  before: z.string().regex(/^\d+$/).optional(),
});

// ====== VALIDATION FUNCTIONS ======

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T.Result<T> {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function validateFxOrder(data: unknown) {
  const res = FxOrderReqSchema.safeParse(data);
  if (res.success) return res.data;
  throw res.error;
}

export function validateFxIfoOrder(data: unknown) {
  const res = FxIfoOrderReqSchema.safeParse(data);
  if (res.success) return res.data;
  throw res.error;
}

export const validateCryptoOrder = (data: unknown) => {
  const res = CryptoOrderReqSchema.safeParse(data);
  if (res.success) return res.data;
  throw new Error(res.error.issues[0]?.message ?? res.error.message);
};

export const validateFxOrderSafe = (data: unknown) => {
  const res = FxOrderReqSchema.safeParse(data);
  return res.success ? { valid: true, data: res.data } : { valid: false, error: res.error.message };
};

export const validateFxIfoOrderSafe = (data: unknown) => {
  const res = FxIfoOrderReqSchema.safeParse(data);
  return res.success ? { valid: true, data: res.data } : { valid: false, error: res.error.message };
};

export const validateCryptoOrderSafe = (data: unknown) => {
  const res = CryptoOrderReqSchema.safeParse(data);
  return res.success ? { valid: true, data: res.data } : { valid: false, error: res.error.message };
};

export const validateFxSymbol = (symbol: string) => T.FxSymbolSchema.safeParse(symbol).success;
export const validateCryptoSymbol = (symbol: string) =>
  T.CryptoSymbolSchema.safeParse(symbol).success;

export const getFxSymbols = () => T.FxSymbols;
export const getCryptoSymbols = () => T.CryptoSymbols;
