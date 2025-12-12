/**
 * Comprehensive tests for src/validation.ts
 * Type-safe validation schema tests with full coverage
 */
import { describe, it, expect } from 'vitest';
import {
  FxOrderReqSchema,
  FxIfdOrderReqSchema,
  FxCloseOrderReqSchema,
  CryptoOrderReqSchema,
  TickerRequestSchema,
  OrderBookRequestSchema,
  KlinesRequestSchema,
  validateFxOrder,
  validateCryptoOrder,
  validateFxSymbol,
  validateCryptoSymbol,
  validateFxOrderSafe,
  validateCryptoOrderSafe,
  getFxSymbols,
  getCryptoSymbols,
} from '../src/validation.js';
import {
  FX_SYMBOLS,
  CRYPTO_SYMBOLS,
  KLINE_INTERVALS,
  createFxLimitOrder,
  createFxStopOrder,
  createFxOcoOrder,
  createCryptoMarketOrder,
  createCryptoLimitOrder,
  createCryptoStopOrder,
} from './helpers/mockTypes.js';

// ====== FxOrderReqSchema Tests ======

describe('FxOrderReqSchema', () => {
  describe('Symbol validation', () => {
    it('should accept all valid FX symbols', () => {
      FX_SYMBOLS.forEach((symbol) => {
        const order = createFxLimitOrder(symbol);
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid FX symbols', () => {
      const invalidSymbols = ['INVALID', 'BTC', 'ETH', '', 'usd_jpy', 'USD-JPY'];
      invalidSymbols.forEach((symbol) => {
        const order = { ...createFxLimitOrder(), symbol };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });

    it('should reject crypto symbols in FX order', () => {
      CRYPTO_SYMBOLS.forEach((symbol) => {
        const order = { ...createFxLimitOrder(), symbol };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Side validation', () => {
    it('should accept BUY and SELL', () => {
      const sides = ['BUY', 'SELL'] as const;
      sides.forEach((side) => {
        const order = createFxLimitOrder('USD_JPY', side);
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid side values', () => {
      const invalidSides = ['buy', 'sell', 'HOLD', 'LONG', 'SHORT', ''];
      invalidSides.forEach((side) => {
        const order = { ...createFxLimitOrder(), side };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Size validation', () => {
    it('should accept valid size formats', () => {
      const validSizes = ['1', '100', '10000', '0.01', '123.456'];
      validSizes.forEach((size) => {
        const order = { ...createFxLimitOrder(), size };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid size formats', () => {
      const invalidSizes = ['', '-1', 'abc', '1,000', '1.2.3'];
      invalidSizes.forEach((size) => {
        const order = { ...createFxLimitOrder(), size };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('LIMIT execution type refine', () => {
    it('should accept LIMIT order with limitPrice', () => {
      const order = createFxLimitOrder();
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject LIMIT order without limitPrice', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        executionType: 'LIMIT' as const,
        size: '10000',
      };
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Missing required price field');
      }
    });

    it('should accept valid limitPrice formats', () => {
      const validPrices = ['150.00', '150', '0.001', '999999.99'];
      validPrices.forEach((limitPrice) => {
        const order = { ...createFxLimitOrder(), limitPrice };
        const result = FxOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('STOP execution type refine', () => {
    it('should accept STOP order with stopPrice', () => {
      const order = createFxStopOrder();
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject STOP order without stopPrice', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'SELL' as const,
        executionType: 'STOP' as const,
        size: '10000',
      };
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Missing required price field');
      }
    });
  });

  describe('OCO execution type refine', () => {
    it('should accept OCO order with oco.limitPrice and oco.stopPrice', () => {
      const order = createFxOcoOrder();
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject OCO order without oco object', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        executionType: 'OCO' as const,
        size: '10000',
      };
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });

    it('should reject OCO order with missing oco.limitPrice', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        executionType: 'OCO' as const,
        size: '10000',
        oco: { stopPrice: '148.00' },
      };
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });

    it('should reject OCO order with missing oco.stopPrice', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        executionType: 'OCO' as const,
        size: '10000',
        oco: { limitPrice: '152.00' },
      };
      const result = FxOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });
});

// ====== FxIfdOrderReqSchema Tests ======

describe('FxIfdOrderReqSchema', () => {
  const baseIfdOrder = {
    symbol: 'USD_JPY',
    side: 'BUY' as const,
    size: '10000',
  };

  describe('First leg validation', () => {
    it('should accept LIMIT first leg with firstPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        firstPrice: '150.00',
        secondExecutionType: 'LIMIT' as const,
        secondPrice: '152.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject LIMIT first leg without firstPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        secondExecutionType: 'LIMIT' as const,
        secondPrice: '152.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });

    it('should accept STOP first leg with firstStopPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'STOP' as const,
        firstStopPrice: '148.00',
        secondExecutionType: 'LIMIT' as const,
        secondPrice: '152.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject STOP first leg without firstStopPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'STOP' as const,
        secondExecutionType: 'LIMIT' as const,
        secondPrice: '152.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });

  describe('Second leg validation', () => {
    it('should accept LIMIT second leg with secondPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        firstPrice: '150.00',
        secondExecutionType: 'LIMIT' as const,
        secondPrice: '152.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject LIMIT second leg without secondPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        firstPrice: '150.00',
        secondExecutionType: 'LIMIT' as const,
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });

    it('should accept STOP second leg with secondStopPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        firstPrice: '150.00',
        secondExecutionType: 'STOP' as const,
        secondStopPrice: '148.00',
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject STOP second leg without secondStopPrice', () => {
      const order = {
        ...baseIfdOrder,
        firstExecutionType: 'LIMIT' as const,
        firstPrice: '150.00',
        secondExecutionType: 'STOP' as const,
      };
      const result = FxIfdOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });
});

// ====== FxCloseOrderReqSchema Tests ======

describe('FxCloseOrderReqSchema', () => {
  describe('settlePosition validation', () => {
    it('should accept valid settlePosition array', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'SELL' as const,
        executionType: 'LIMIT' as const,
        limitPrice: '152.00',
        settlePosition: [
          { positionId: 'pos-123', size: '5000' },
          { positionId: 'pos-456', size: '5000' },
        ],
      };
      const result = FxCloseOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject empty settlePosition array', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'SELL' as const,
        executionType: 'LIMIT' as const,
        limitPrice: '152.00',
        settlePosition: [],
      };
      const result = FxCloseOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });

    it('should reject settlePosition with empty positionId', () => {
      const order = {
        symbol: 'USD_JPY',
        side: 'SELL' as const,
        executionType: 'LIMIT' as const,
        limitPrice: '152.00',
        settlePosition: [{ positionId: '', size: '5000' }],
      };
      const result = FxCloseOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });
});

// ====== CryptoOrderReqSchema Tests ======

describe('CryptoOrderReqSchema', () => {
  describe('Symbol validation', () => {
    it('should accept all valid Crypto symbols', () => {
      CRYPTO_SYMBOLS.forEach((symbol) => {
        const order = createCryptoMarketOrder(symbol);
        const result = CryptoOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });

    it('should reject FX symbols in Crypto order', () => {
      FX_SYMBOLS.forEach((symbol) => {
        const order = { ...createCryptoMarketOrder(), symbol };
        const result = CryptoOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });

    it('should reject invalid Crypto symbols', () => {
      const invalidSymbols = ['INVALID', 'btc', 'Bitcoin', ''];
      invalidSymbols.forEach((symbol) => {
        const order = { ...createCryptoMarketOrder(), symbol };
        const result = CryptoOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('MARKET execution type', () => {
    it('should accept MARKET order without price fields', () => {
      const order = createCryptoMarketOrder();
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should accept MARKET order with optional timeInForce', () => {
      const order = { ...createCryptoMarketOrder(), timeInForce: 'FAK' as const };
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });
  });

  describe('LIMIT execution type refine', () => {
    it('should accept LIMIT order with price', () => {
      const order = createCryptoLimitOrder();
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject LIMIT order without price', () => {
      const order = {
        symbol: 'BTC',
        side: 'BUY' as const,
        executionType: 'LIMIT' as const,
        size: '0.01',
      };
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Missing required price field');
      }
    });
  });

  describe('STOP execution type refine', () => {
    it('should accept STOP order with losscutPrice', () => {
      const order = createCryptoStopOrder();
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('should reject STOP order without losscutPrice', () => {
      const order = {
        symbol: 'BTC',
        side: 'SELL' as const,
        executionType: 'STOP' as const,
        size: '0.01',
      };
      const result = CryptoOrderReqSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });

  describe('timeInForce validation', () => {
    it('should accept valid timeInForce values', () => {
      const validTif = ['FAK', 'FAS', 'SOK'] as const;
      validTif.forEach((timeInForce) => {
        const order = { ...createCryptoMarketOrder(), timeInForce };
        const result = CryptoOrderReqSchema.safeParse(order);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid timeInForce values', () => {
      const invalidTif = ['GTC', 'IOC', 'fak', ''];
      invalidTif.forEach((timeInForce) => {
        const order = { ...createCryptoMarketOrder(), timeInForce };
        const result = CryptoOrderReqSchema.safeParse(order);
        expect(result.success).toBe(false);
      });
    });
  });
});

// ====== Public API Schema Tests ======

describe('TickerRequestSchema', () => {
  it('should accept valid symbol', () => {
    const result = TickerRequestSchema.safeParse({ symbol: 'BTC' });
    expect(result.success).toBe(true);
  });

  it('should reject empty symbol', () => {
    const result = TickerRequestSchema.safeParse({ symbol: '' });
    expect(result.success).toBe(false);
  });

  it('should reject symbol exceeding max length', () => {
    const result = TickerRequestSchema.safeParse({ symbol: 'A'.repeat(21) });
    expect(result.success).toBe(false);
  });
});

describe('OrderBookRequestSchema', () => {
  it('should accept symbol only', () => {
    const result = OrderBookRequestSchema.safeParse({ symbol: 'BTC' });
    expect(result.success).toBe(true);
  });

  it('should accept symbol with depth', () => {
    const result = OrderBookRequestSchema.safeParse({ symbol: 'BTC', depth: '20' });
    expect(result.success).toBe(true);
  });
});

describe('KlinesRequestSchema', () => {
  it('should accept valid interval values', () => {
    KLINE_INTERVALS.forEach((interval) => {
      const result = KlinesRequestSchema.safeParse({ symbol: 'BTC', interval });
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid interval values', () => {
    const invalidIntervals = ['2m', '3h', '2d', '1y', ''];
    invalidIntervals.forEach((interval) => {
      const result = KlinesRequestSchema.safeParse({ symbol: 'BTC', interval });
      expect(result.success).toBe(false);
    });
  });

  it('should accept optional count and before', () => {
    const result = KlinesRequestSchema.safeParse({
      symbol: 'BTC',
      interval: '1h',
      count: '100',
      before: '1704067200000',
    });
    expect(result.success).toBe(true);
  });
});

// ====== Validation Function Tests ======

describe('validateFxOrder', () => {
  it('should return parsed order on valid input', () => {
    const order = createFxLimitOrder();
    const result = validateFxOrder(order);
    expect(result.symbol).toBe('USD_JPY');
    expect(result.executionType).toBe('LIMIT');
  });

  it('should throw ZodError on invalid input', () => {
    const invalidOrder = { symbol: 'INVALID' };
    expect(() => validateFxOrder(invalidOrder)).toThrow();
  });
});

describe('validateCryptoOrder', () => {
  it('should return parsed order on valid input', () => {
    const order = createCryptoMarketOrder();
    const result = validateCryptoOrder(order);
    expect(result.symbol).toBe('BTC');
    expect(result.executionType).toBe('MARKET');
  });

  it('should throw ZodError on invalid input', () => {
    const invalidOrder = { symbol: 'INVALID' };
    expect(() => validateCryptoOrder(invalidOrder)).toThrow();
  });
});

describe('validateFxOrderSafe', () => {
  it('should return { valid: true, data } on valid input', () => {
    const order = createFxLimitOrder();
    const result = validateFxOrderSafe(order);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.symbol).toBe('USD_JPY');
    }
  });

  it('should return { valid: false, error } on invalid input', () => {
    const invalidOrder = { symbol: 'INVALID' };
    const result = validateFxOrderSafe(invalidOrder);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validateCryptoOrderSafe', () => {
  it('should return { valid: true, data } on valid input', () => {
    const order = createCryptoMarketOrder();
    const result = validateCryptoOrderSafe(order);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.symbol).toBe('BTC');
    }
  });

  it('should return { valid: false, error } on invalid input', () => {
    const invalidOrder = { symbol: 'INVALID' };
    const result = validateCryptoOrderSafe(invalidOrder);
    expect(result.valid).toBe(false);
  });
});

describe('validateFxSymbol', () => {
  it('should return true for valid FX symbols', () => {
    FX_SYMBOLS.forEach((symbol) => {
      expect(validateFxSymbol(symbol)).toBe(true);
    });
  });

  it('should return false for invalid symbols', () => {
    expect(validateFxSymbol('INVALID')).toBe(false);
    expect(validateFxSymbol('BTC')).toBe(false);
    expect(validateFxSymbol('')).toBe(false);
  });
});

describe('validateCryptoSymbol', () => {
  it('should return true for valid Crypto symbols', () => {
    CRYPTO_SYMBOLS.forEach((symbol) => {
      expect(validateCryptoSymbol(symbol)).toBe(true);
    });
  });

  it('should return false for invalid symbols', () => {
    expect(validateCryptoSymbol('INVALID')).toBe(false);
    expect(validateCryptoSymbol('USD_JPY')).toBe(false);
    expect(validateCryptoSymbol('')).toBe(false);
  });
});

describe('getFxSymbols', () => {
  it('should return all FX symbols', () => {
    const symbols = getFxSymbols();
    expect(symbols.length).toBe(FX_SYMBOLS.length);
    FX_SYMBOLS.forEach((symbol) => {
      expect(symbols).toContain(symbol);
    });
  });
});

describe('getCryptoSymbols', () => {
  it('should return all Crypto symbols', () => {
    const symbols = getCryptoSymbols();
    expect(symbols.length).toBe(CRYPTO_SYMBOLS.length);
    CRYPTO_SYMBOLS.forEach((symbol) => {
      expect(symbols).toContain(symbol);
    });
  });
});
