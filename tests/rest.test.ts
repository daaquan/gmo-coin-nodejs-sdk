import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { FxPrivateRestClient } from '../src/rest.js';

describe('FxPrivateRestClient', () => {
  const mockApiKey = 'test-api-key';
  const mockSecret = 'test-secret';
  let client: FxPrivateRestClient;
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new FxPrivateRestClient(mockApiKey, mockSecret);
  });

  describe('getAssets', () => {
    it('should return assets on successful response', async () => {
      const mockData = {
        equity: '1000000',
        availableAmount: '900000',
        balance: '1000000',
        estimatedTradeFee: '0',
        margin: '100000',
        marginRatio: '10',
        positionLossGain: '0',
        totalSwap: '0',
        transferableAmount: '900000',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 0, data: mockData, responsetime: '2023-01-01T00:00:00.000Z' }),
      });

      const result = await client.getAssets();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.equity).toBe('1000000');
      }
    });

    it('should return success: false on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 1, message: 'Authentication failed' }),
      });

      const result = await client.getAssets();
      expect(result.success).toBe(false);
    });
  });
});
