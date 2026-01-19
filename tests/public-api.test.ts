import { describe, it, expect, beforeEach } from 'vitest';
import { FxPublicRestClient, CryptoPublicRestClient } from '../src/rest-public.js';
import * as validation from '../src/validation.js';

describe('Public API Clients', () => {
  describe('FxPublicRestClient', () => {
    let client: FxPublicRestClient;

    beforeEach(() => {
      client = new FxPublicRestClient();
    });

    it('should create FX public client', () => {
      expect(client).toBeDefined();
    });

    it('should have getTicker method', () => {
      expect(typeof client.getTicker).toBe('function');
    });

    it('should have getOrderBook method', () => {
      expect(typeof client.getOrderBook).toBe('function');
    });

    it('should have getTrades method', () => {
      expect(typeof client.getTrades).toBe('function');
    });

    it('should have getKlines method', () => {
      expect(typeof client.getKlines).toBe('function');
    });

    it('should return supported FX symbols', () => {
      const symbols = client.getSupportedSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('USD_JPY');
      expect(symbols).toContain('EUR_JPY');
    });

    it('should support custom base URL', () => {
      const customUrl = 'https://custom.example.com/public';
      const customClient = new FxPublicRestClient(customUrl);
      expect(customClient).toBeDefined();
    });
  });

  describe('CryptoPublicRestClient', () => {
    let client: CryptoPublicRestClient;

    beforeEach(() => {
      client = new CryptoPublicRestClient();
    });

    it('should create Crypto public client', () => {
      expect(client).toBeDefined();
    });

    it('should have getTicker method', () => {
      expect(typeof client.getTicker).toBe('function');
    });

    it('should have getOrderBook method', () => {
      expect(typeof client.getOrderBook).toBe('function');
    });

    it('should have getTrades method', () => {
      expect(typeof client.getTrades).toBe('function');
    });

    it('should have getKlines method', () => {
      expect(typeof client.getKlines).toBe('function');
    });

    it('should return supported Crypto symbols', () => {
      const symbols = client.getSupportedSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
    });

    it('should support custom base URL', () => {
      const customUrl = 'https://custom.example.com/public';
      const customClient = new CryptoPublicRestClient(customUrl);
      expect(customClient).toBeDefined();
    });
  });
});

describe('Input Validation', () => {
  describe('FX Validation', () => {
    it('should validate FX order request', () => {
      const validOrder = {
        symbol: 'USD_JPY',
        side: 'BUY',
        executionType: 'LIMIT',
        size: '1.0',
        limitPrice: '150.50',
      };

      const result = validation.validateFxOrderSafe(validOrder);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid FX symbol', () => {
      const invalidOrder = {
        symbol: 'INVALID_JPY',
        side: 'BUY',
        executionType: 'LIMIT',
        size: '1.0',
        limitPrice: '150.50',
      };

      const result = validation.validateFxOrderSafe(invalidOrder);
      expect(result.valid).toBe(false);
    });

    it('should reject LIMIT order without limitPrice', () => {
      const invalidOrder = {
        symbol: 'USD_JPY',
        side: 'BUY',
        executionType: 'LIMIT',
        size: '1.0',
      };

      const result = validation.validateFxOrderSafe(invalidOrder);
      expect(result.valid).toBe(false);
    });

    it('should reject STOP order without stopPrice', () => {
      const invalidOrder = {
        symbol: 'USD_JPY',
        side: 'BUY',
        executionType: 'STOP',
        size: '1.0',
      };

      const result = validation.validateFxOrderSafe(invalidOrder);
      expect(result.valid).toBe(false);
    });

    it('should validate FX symbol', () => {
      expect(validation.validateFxSymbol('USD_JPY')).toBe(true);
      expect(validation.validateFxSymbol('EUR_JPY')).toBe(true);
      expect(validation.validateFxSymbol('INVALID')).toBe(false);
    });

    it('should return FX symbols list', () => {
      const symbols = validation.getFxSymbols();
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('USD_JPY');
    });
  });

  describe('Crypto Validation', () => {
    it('should validate Crypto order request', () => {
      const validOrder = {
        symbol: 'BTC',
        side: 'BUY',
        executionType: 'MARKET',
        size: '0.1',
      };

      const result = validation.validateCryptoOrderSafe(validOrder);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Crypto symbol', () => {
      const invalidOrder = {
        symbol: 'INVALID',
        side: 'BUY',
        executionType: 'MARKET',
        size: '0.1',
      };

      const result = validation.validateCryptoOrderSafe(invalidOrder);
      expect(result.valid).toBe(false);
    });

    it('should reject LIMIT order without price', () => {
      const invalidOrder = {
        symbol: 'BTC',
        side: 'BUY',
        executionType: 'LIMIT',
        size: '0.1',
      };

      const result = validation.validateCryptoOrderSafe(invalidOrder);
      expect(result.valid).toBe(false);
    });

    it('should validate Crypto symbol', () => {
      expect(validation.validateCryptoSymbol('BTC')).toBe(true);
      expect(validation.validateCryptoSymbol('ETH')).toBe(true);
      expect(validation.validateCryptoSymbol('INVALID')).toBe(false);
    });

    it('should return Crypto symbols list', () => {
      const symbols = validation.getCryptoSymbols();
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
    });
  });
});
