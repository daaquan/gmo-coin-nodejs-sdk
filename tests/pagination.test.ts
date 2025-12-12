import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../src/rest.js';
import * as T from '../src/types.js';

describe('Unified Pagination', () => {
  let fxClient: FxPrivateRestClient;
  let cryptoClient: CryptoPrivateRestClient;

  beforeEach(() => {
    fxClient = new FxPrivateRestClient('test-fx-key', 'test-fx-secret', 'https://mock.test/forex');
    cryptoClient = new CryptoPrivateRestClient('test-crypto-key', 'test-crypto-secret', 'https://mock.test/crypto');

    // Mock fetch to avoid actual HTTP calls
    global.fetch = vi.fn();
  });

  describe('FX Pagination (Cursor-based: prevId + count)', () => {
    it('should support prevId + count pagination', async () => {
      const mockResp = {
        status: 0,
        data: [
          { rootOrderId: 1, orderId: 1, symbol: 'USD_JPY', side: 'BUY', orderType: 'NORMAL', executionType: 'LIMIT', settleType: 'OPEN', size: '1.0', timestamp: '2024-01-01T00:00:00Z', status: 'WAITING' }
        ],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // Should pass prevId and count to the API
      const result = await fxClient.getActiveOrders({
        symbol: 'USD_JPY',
        prevId: '123',
        count: '50'
      });

      expect(result.status).toBe(0);
      expect(result.data).toHaveLength(1);

      // Verify fetch was called with correct parameters
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('prevId=123');
      expect(callUrl.toString()).toContain('count=50');
    });

    it('should support pagination on getOpenPositions', async () => {
      const mockResp = {
        status: 0,
        data: [
          { positionId: 1, symbol: 'USD_JPY', side: 'BUY', size: '1.0', price: '150.00' }
        ],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await fxClient.getOpenPositions({
        symbol: 'EUR_JPY',
        prevId: '456',
        count: '25'
      });

      expect(result.status).toBe(0);
      expect(result.data).toHaveLength(1);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('prevId=456');
      expect(callUrl.toString()).toContain('count=25');
    });

    it('should handle missing pagination params gracefully', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await fxClient.getActiveOrders({ symbol: 'USD_JPY' });

      expect(result.status).toBe(0);

      // Verify prevId and count are not in URL when not provided
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).not.toContain('prevId=');
      expect(callUrl.toString()).not.toContain('count=');
    });

    it('should warn when offset/limit are provided to FX methods', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // Try to use offset/limit on FX (not supported)
      await fxClient.getActiveOrders({
        symbol: 'USD_JPY',
        offset: '0',
        limit: '50'
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('FX API does not support offset/limit pagination')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Crypto Pagination (Page-based: limit/pageSize)', () => {
    it('should support limit parameter for pagination', async () => {
      const mockResp = {
        status: 0,
        data: [
          { rootOrderId: '1', orderId: '1', symbol: 'BTC', side: 'BUY', executionType: 'LIMIT', size: '0.1', status: 'WAITING', timestamp: '2024-01-01T00:00:00Z' }
        ],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await cryptoClient.getActiveOrders({
        symbol: 'BTC',
        limit: '100'
      });

      expect(result.status).toBe(0);
      expect(result.data).toHaveLength(1);

      // Verify limit is converted to pageSize for API
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=100');
    });

    it('should support legacy pageSize parameter', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await cryptoClient.getOpenPositions({
        pageSize: '50'
      });

      expect(result.status).toBe(0);

      // Verify pageSize is still sent to API for backward compatibility
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=50');
    });

    it('should prefer limit over pageSize when both provided', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      await cryptoClient.getLatestExecutions({
        symbol: 'ETH',
        limit: '75',
        pageSize: '25' // Should be ignored
      });

      // Verify limit takes precedence
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=75');
      // pageSize param should appear once with the limit value
      const matches = callUrl.toString().match(/pageSize=/g);
      expect(matches).toHaveLength(1);
    });

    it('should support pagination on getExecutions', async () => {
      const mockResp = {
        status: 0,
        data: [
          { executionId: '1', orderId: '1', symbol: 'BTC', side: 'BUY', executedPrice: '50000', executedSize: '0.1', timestamp: '2024-01-01T00:00:00Z' }
        ],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await cryptoClient.getExecutions({
        symbol: 'BTC',
        orderId: '123',
        limit: '50'
      });

      expect(result.status).toBe(0);
      expect(result.data).toHaveLength(1);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=50');
      expect(callUrl.toString()).toContain('orderId=123');
    });

    it('should warn when prevId is provided to Crypto methods', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // Try to use prevId on Crypto (not supported)
      await cryptoClient.getActiveOrders({
        symbol: 'BTC',
        prevId: '123'
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Crypto API does not support cursor-based pagination')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Backward Compatibility', () => {
    it('should still work with old FX method signature (prevId + count)', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // Old way of calling (directly passing prevId and count)
      const result = await fxClient.getActiveOrders({
        symbol: 'USD_JPY',
        prevId: 'old-way-123',
        count: '10'
      });

      expect(result.status).toBe(0);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('prevId=old-way-123');
      expect(callUrl.toString()).toContain('count=10');
    });

    it('should still work with old Crypto method signature (pageSize)', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // Old way of calling (directly passing pageSize)
      const result = await cryptoClient.getActiveOrders({
        symbol: 'BTC',
        pageSize: '20'
      });

      expect(result.status).toBe(0);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=20');
    });
  });

  describe('Type Safety', () => {
    it('should provide correct types for PaginationOptions', () => {
      const opts: T.PaginationOptions = {
        prevId: 'cursor-123',
        count: '50',
        limit: '100',
        pageSize: '50',
        offset: '0'
      };

      expect(opts.prevId).toBe('cursor-123');
      expect(opts.count).toBe('50');
      expect(opts.limit).toBe('100');
      expect(opts.pageSize).toBe('50');
      expect(opts.offset).toBe('0');
    });

    it('should allow mixing symbol with pagination options in FX', () => {
      const opts: Parameters<typeof fxClient.getActiveOrders>[0] = {
        symbol: 'USD_JPY',
        prevId: '123',
        count: '50'
      };

      expect(opts.symbol).toBe('USD_JPY');
      expect(opts.prevId).toBe('123');
      expect(opts.count).toBe('50');
    });

    it('should allow mixing symbol with pagination options in Crypto', () => {
      const opts: Parameters<typeof cryptoClient.getActiveOrders>[0] = {
        symbol: 'BTC',
        limit: '100'
      };

      expect(opts.symbol).toBe('BTC');
      expect(opts.limit).toBe('100');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pagination options', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await fxClient.getActiveOrders({});

      expect(result.status).toBe(0);
    });

    it('should handle undefined pagination options', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      const result = await cryptoClient.getOpenPositions(undefined);

      expect(result.status).toBe(0);
    });

    it('should handle zero as pagination value', async () => {
      const mockResp = {
        status: 0,
        data: [],
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      await cryptoClient.getActiveOrders({
        offset: '0',
        limit: '1'
      });

      // Should still send limit as pageSize
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl.toString()).toContain('pageSize=1');
    });
  });
});
