import { describe, it, expect } from 'vitest';
import {
  determineClientType,
  isValidSymbol,
  isValidExecutionType,
  FX_SYMBOLS,
  CRYPTO_SYMBOLS,
} from '../service/lib/clientRouter.js';

describe('clientRouter', () => {
  describe('determineClientType', () => {
    it('should identify FX symbols (containing underscore)', () => {
      expect(determineClientType('USD_JPY')).toBe('fx');
      expect(determineClientType('EUR_JPY')).toBe('fx');
      expect(determineClientType('GBP_USD')).toBe('fx');
    });

    it('should identify Crypto symbols (single token)', () => {
      expect(determineClientType('BTC')).toBe('crypto');
      expect(determineClientType('ETH')).toBe('crypto');
      expect(determineClientType('SHIB')).toBe('crypto');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate FX symbols', () => {
      expect(isValidSymbol('USD_JPY')).toBe(true);
      expect(isValidSymbol('EUR_JPY')).toBe(true);
      expect(isValidSymbol('INVALID_PAIR')).toBe(false);
    });

    it('should validate Crypto symbols', () => {
      expect(isValidSymbol('BTC')).toBe(true);
      expect(isValidSymbol('ETH')).toBe(true);
      expect(isValidSymbol('INVALID')).toBe(false);
    });
  });

  describe('isValidExecutionType', () => {
    describe('FX symbols', () => {
      it('should accept LIMIT, STOP, OCO', () => {
        expect(isValidExecutionType('USD_JPY', 'LIMIT')).toBe(true);
        expect(isValidExecutionType('USD_JPY', 'STOP')).toBe(true);
        expect(isValidExecutionType('USD_JPY', 'OCO')).toBe(true);
      });

      it('should reject MARKET', () => {
        expect(isValidExecutionType('USD_JPY', 'MARKET')).toBe(false);
      });
    });

    describe('Crypto symbols', () => {
      it('should accept MARKET, LIMIT, STOP', () => {
        expect(isValidExecutionType('BTC', 'MARKET')).toBe(true);
        expect(isValidExecutionType('BTC', 'LIMIT')).toBe(true);
        expect(isValidExecutionType('BTC', 'STOP')).toBe(true);
      });

      it('should reject OCO', () => {
        expect(isValidExecutionType('BTC', 'OCO')).toBe(false);
      });
    });
  });

  describe('Symbol lists', () => {
    it('should have FX_SYMBOLS defined', () => {
      expect(FX_SYMBOLS.length).toBeGreaterThan(0);
      expect(FX_SYMBOLS).toContain('USD_JPY');
      expect(FX_SYMBOLS).toContain('EUR_JPY');
    });

    it('should have CRYPTO_SYMBOLS defined', () => {
      expect(CRYPTO_SYMBOLS.length).toBeGreaterThan(0);
      expect(CRYPTO_SYMBOLS).toContain('BTC');
      expect(CRYPTO_SYMBOLS).toContain('ETH');
    });
  });
});
