import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CryptoPrivateRestClient } from '../src/rest.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../src/rateLimiter.js', () => ({
  getGate: { wait: vi.fn().mockResolvedValue(undefined) },
  postGate: { wait: vi.fn().mockResolvedValue(undefined) },
}));

describe('CryptoPrivateRestClient', () => {
  let client: CryptoPrivateRestClient;
  const mockApiKey = 'test-api-key';
  const mockSecret = 'test-secret';

  beforeEach(() => {
    client = new CryptoPrivateRestClient(mockApiKey, mockSecret);
    mockFetch.mockClear();
  });

  describe('getAssets', () => {
    it('should return assets on successful response', async () => {
      const mockData = [
        { symbol: 'BTC', amount: '0.5', available: '0.5' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 0, data: mockData, responsetime: '2025-01-01T00:00:00.000Z' }),
      });

      const result = await client.getAssets();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].symbol).toBe('BTC');
      }
    });

    it('should return success: false on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 1, message: 'Auth failed' }),
      });

      const result = await client.getAssets();
      expect(result.success).toBe(false);
    });
  });

  describe('placeOrder', () => {
    it('should place MARKET order successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 0, data: { rootOrderId: '12345' } }),
      });

      const result = await client.placeOrder({
        symbol: 'BTC',
        side: 'BUY',
        executionType: 'MARKET',
        size: '0.5',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rootOrderId).toBe('12345');
      }
    });
  });
});