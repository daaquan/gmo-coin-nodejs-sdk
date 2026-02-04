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
export const FxIfdOrderReqSchema = z.any();
export const FxCloseOrderReqSchema = z.any();
export const CryptoOrderReqSchema = z.any();
export const TickerRequestSchema = z.any();
export const OrderBookRequestSchema = z.any();
export const KlinesRequestSchema = z.any();

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
  throw res.error;
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
export const validateCryptoSymbol = (symbol: string) => T.CryptoSymbolSchema.safeParse(symbol).success;

export const getFxSymbols = () => T.FxSymbols;
export const getCryptoSymbols = () => T.CryptoSymbols;
