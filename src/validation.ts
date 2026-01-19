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

export const validateCryptoOrder = (data: unknown) => {
  const res = CryptoOrderReqSchema.safeParse(data);
  if (res.success) return res.data;
  throw res.error;
};

export const validateFxOrderSafe = (data: unknown) => {
  const res = FxOrderReqSchema.safeParse(data);
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
