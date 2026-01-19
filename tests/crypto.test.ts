import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CryptoPrivateRestClient } from '../src/rest.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock rate limiter
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

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new CryptoPrivateRestClient('', mockSecret)).toThrow(
        'CryptoPrivateRestClient: Missing API credentials',
      );
    });

    it('should throw error if secret is missing', () => {
      expect(() => new CryptoPrivateRestClient(mockApiKey, '')).toThrow(
        'CryptoPrivateRestClient: Missing API credentials',
      );
    });

    it('should create client with valid credentials', () => {
      expect(client).toBeInstanceOf(CryptoPrivateRestClient);
    });
  });

  describe('getAssets', () => {
    it('should return assets on successful response', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            amount: '0.5',
            available: '0.5',
          },
          {
            symbol: 'ETH',
            amount: '10.0',
            available: '10.0',
          },
          {
            symbol: 'USDT',
            amount: '10000.0',
            available: '10000.0',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getAssets();
      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].symbol).toBe('BTC');
    });

    it('should throw error on API error response', async () => {
      const mockErrorResponse = {
        status: 1,
        data: { code: 'ERR_AUTH', message: 'Authentication failed' },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(client.getAssets()).rejects.toThrow();
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          status: 1,
          data: { message: 'Bad Request' },
        }),
      });

      await expect(client.getAssets()).rejects.toThrow();
    });
  });

  describe('getOpenPositions', () => {
    it('should return open positions', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            sumSize: '1.0',
            avgPrice: '45000.00',
            sumPrice: '45000.00',
            side: 'BUY' as const,
          },
          {
            symbol: 'ETH',
            sumSize: '5.0',
            avgPrice: '3000.00',
            sumPrice: '15000.00',
            side: 'BUY' as const,
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getOpenPositions();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].symbol).toBe('BTC');
    });

    it('should filter positions by symbol', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            sumSize: '1.0',
            avgPrice: '45000.00',
            sumPrice: '45000.00',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getOpenPositions({ symbol: 'BTC' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe('BTC');
    });

    it('should return empty array when no positions', async () => {
      const mockResponse = {
        status: 0,
        data: [],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getOpenPositions();
      expect(result.data).toEqual([]);
    });
  });

  describe('getActiveOrders', () => {
    it('should return active orders', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12345',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executionType: 'LIMIT' as const,
            size: '0.5',
            price: '44000.00',
            losscutPrice: undefined,
            status: 'WAITING' as const,
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getActiveOrders();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe('BTC');
      expect(result.data[0].executionType).toBe('LIMIT');
    });

    it('should filter orders by symbol', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12345',
            orderId: '67890',
            symbol: 'ETH',
            side: 'SELL' as const,
            executionType: 'MARKET' as const,
            size: '5.0',
            status: 'ORDERED' as const,
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getActiveOrders({ symbol: 'ETH' });
      expect(result.data[0].symbol).toBe('ETH');
    });
  });

  describe('getExecutions', () => {
    it('should return execution history', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-123',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executedPrice: '44500.00',
            executedSize: '0.5',
            timestamp: '2025-01-01T00:10:00.000Z',
          },
          {
            executionId: 'exec-124',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executedPrice: '44600.00',
            executedSize: '0.5',
            timestamp: '2025-01-01T00:11:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getExecutions();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].symbol).toBe('BTC');
    });

    it('should filter executions by symbol', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-125',
            orderId: '67891',
            symbol: 'ETH',
            side: 'SELL' as const,
            executedPrice: '3100.00',
            executedSize: '5.0',
            timestamp: '2025-01-01T01:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getExecutions({ symbol: 'ETH' });
      expect(result.data[0].symbol).toBe('ETH');
    });

    it('should filter executions by orderId', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-123',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executedPrice: '44500.00',
            executedSize: '0.5',
            timestamp: '2025-01-01T00:10:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getExecutions({ orderId: '67890' });
      expect(result.data[0].orderId).toBe('67890');
    });
  });

  describe('getLatestExecutions', () => {
    it('should return latest executions', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-200',
            orderId: '67900',
            symbol: 'BTC',
            side: 'BUY' as const,
            executedPrice: '45000.00',
            executedSize: '0.1',
            timestamp: '2025-01-01T02:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getLatestExecutions({ symbol: 'BTC' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe('BTC');
    });
  });

  describe('getPositionSummary', () => {
    it('should return position summary', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            side: 'BUY' as const,
            size: '1.5',
            price: '45000.00',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getPositionSummary({ symbol: 'BTC' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe('BTC');
      expect(result.data[0].size).toBe('1.5');
    });
  });

  describe('placeOrder', () => {
    it('should place MARKET order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12345',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeOrder({
        symbol: 'BTC',
        side: 'BUY' as const,
        executionType: 'MARKET' as const,
        size: '0.5',
      });

      expect(result.data.rootOrderId).toBe('12345');
    });

    it('should place LIMIT order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12346',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeOrder({
        symbol: 'BTC',
        side: 'BUY' as const,
        executionType: 'LIMIT' as const,
        size: '0.5',
        price: '44000.00',
      });

      expect(result.data.rootOrderId).toBe('12346');
    });

    it('should throw error when LIMIT order missing price', () => {
      expect(() =>
        client.placeOrder({
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'LIMIT' as const,
          size: '0.5',
        }),
      ).toThrow('LIMIT orders require price field');
    });

    it('should place STOP order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12347',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeOrder({
        symbol: 'BTC',
        side: 'SELL' as const,
        executionType: 'STOP' as const,
        size: '0.5',
        losscutPrice: '42000.00',
      });

      expect(result.data.rootOrderId).toBe('12347');
    });

    it('should throw error when STOP order missing losscutPrice', () => {
      expect(() =>
        client.placeOrder({
          symbol: 'BTC',
          side: 'SELL' as const,
          executionType: 'STOP' as const,
          size: '0.5',
        }),
      ).toThrow('STOP orders require losscutPrice field');
    });

    it('should handle order placement errors', async () => {
      const mockErrorResponse = {
        status: 1,
        data: { code: 'ERR_ORDER', message: 'Order size too large' },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(
        client.placeOrder({
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'MARKET' as const,
          size: '1000.0', // Very large order
        }),
      ).rejects.toThrow();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: { result: 'success' },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.cancelOrder('12345');
      expect(result.status).toBe(0);
    });

    it('should throw error for invalid order ID', async () => {
      const mockErrorResponse = {
        status: 1,
        data: { code: 'ERR_ORDER_ID', message: 'Order not found' },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(client.cancelOrder('invalid-id')).rejects.toThrow();
    });
  });

  describe('changeOrder', () => {
    it('should change order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12345',
          orderId: '67890',
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'LIMIT' as const,
          size: '0.5',
          price: '45000.00',
          status: 'WAITING' as const,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.changeOrder({
        orderId: '67890',
        price: '45000.00',
      });
      expect(result.data.orderId).toBe('67890');
      expect(result.data.price).toBe('45000.00');
    });
  });

  describe('cancelOrders', () => {
    it('should cancel multiple orders successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12345',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executionType: 'LIMIT' as const,
            size: '0.5',
            status: 'WAITING' as const,
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.cancelOrders({ rootOrderIds: ['12345', '12346'] });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('cancelBulk', () => {
    it('should cancel bulk orders successfully', async () => {
      const mockResponse = {
        status: 0,
        data: null,
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.cancelBulk({ symbols: ['BTC'], side: 'BUY' });
      expect(result.status).toBe(0);
    });
  });

  describe('closePosition', () => {
    it('should close position with explicit side', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12348',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.closePosition('BTC', '0.5', 'SELL');
      expect(result.data.rootOrderId).toBe('12348');
    });

    it('should close position and auto-detect side from open position', async () => {
      // First, get open position
      const positionResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            sumSize: '0.5',
            avgPrice: '45000.00',
            sumPrice: '22500.00',
            side: 'BUY' as const,
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      // Then, close position
      const closeResponse = {
        status: 0,
        data: {
          rootOrderId: '12349',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(positionResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(closeResponse),
        });

      const result = await client.closePosition('BTC', '0.5');
      expect(result.data.rootOrderId).toBe('12349');
    });

    it('should throw error when no position exists', async () => {
      const mockResponse = {
        status: 0,
        data: [],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(client.closePosition('BTC', '0.5')).rejects.toThrow(/No open position/);
    });
  });

  describe('getSupportedSymbols', () => {
    it('should return list of supported symbols', () => {
      const symbols = client.getSupportedSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('SOL');
    });

    it('should include commonly traded crypto symbols', () => {
      const symbols = client.getSupportedSymbols();
      const expectedSymbols = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH'];
      expectedSymbols.forEach((symbol) => {
        expect(symbols).toContain(symbol);
      });
    });
  });

  describe('placeOcoOrder', () => {
    it('should place OCO order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12350',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeOcoOrder({
        symbol: 'BTC',
        side: 'BUY',
        size: '0.5',
        limitPrice: '46000.00',
        stopPrice: '42000.00',
      });

      expect(result.data.rootOrderId).toBe('12350');
    });

    it('should throw error when OCO missing limitPrice', () => {
      expect(() =>
        client.placeOcoOrder({
          symbol: 'BTC',
          side: 'BUY',
          size: '0.5',
          limitPrice: '',
          stopPrice: '42000.00',
        }),
      ).toThrow('OCO orders require limitPrice field');
    });

    it('should throw error when OCO missing stopPrice', () => {
      expect(() =>
        client.placeOcoOrder({
          symbol: 'BTC',
          side: 'BUY',
          size: '0.5',
          limitPrice: '46000.00',
          stopPrice: '',
        }),
      ).toThrow('OCO orders require stopPrice field');
    });
  });

  describe('placeIfdOrder', () => {
    it('should place IFD order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12351',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeIfdOrder({
        symbol: 'BTC',
        firstSide: 'BUY',
        firstExecutionType: 'LIMIT',
        firstSize: '0.5',
        firstPrice: '45000.00',
        secondExecutionType: 'LIMIT',
        secondSize: '0.5',
        secondPrice: '46000.00',
      });

      expect(result.data.rootOrderId).toBe('12351');
    });

    it('should throw error when first leg LIMIT missing price', () => {
      expect(() =>
        client.placeIfdOrder({
          symbol: 'BTC',
          firstSide: 'BUY',
          firstExecutionType: 'LIMIT',
          firstSize: '0.5',
          secondExecutionType: 'LIMIT',
          secondSize: '0.5',
          secondPrice: '46000.00',
        }),
      ).toThrow('First leg LIMIT requires firstPrice field');
    });

    it('should throw error when second leg STOP missing stopPrice', () => {
      expect(() =>
        client.placeIfdOrder({
          symbol: 'BTC',
          firstSide: 'BUY',
          firstExecutionType: 'LIMIT',
          firstSize: '0.5',
          firstPrice: '45000.00',
          secondExecutionType: 'STOP',
          secondSize: '0.5',
        }),
      ).toThrow('Second leg STOP requires secondStopPrice field');
    });
  });

  describe('placeIfdocoOrder', () => {
    it('should place IFDOCO order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: {
          rootOrderId: '12352',
        },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.placeIfdocoOrder({
        symbol: 'BTC',
        firstSide: 'BUY',
        firstExecutionType: 'LIMIT',
        firstSize: '0.5',
        firstPrice: '45000.00',
        secondLimitPrice: '46000.00',
        secondStopPrice: '42000.00',
        secondSize: '0.5',
      });

      expect(result.data.rootOrderId).toBe('12352');
    });

    it('should throw error when IFDOCO missing secondLimitPrice', () => {
      expect(() =>
        client.placeIfdocoOrder({
          symbol: 'BTC',
          firstSide: 'BUY',
          firstExecutionType: 'LIMIT',
          firstSize: '0.5',
          firstPrice: '45000.00',
          secondLimitPrice: '',
          secondStopPrice: '42000.00',
          secondSize: '0.5',
        }),
      ).toThrow('IFDOCO requires secondLimitPrice field');
    });

    it('should throw error when IFDOCO missing secondStopPrice', () => {
      expect(() =>
        client.placeIfdocoOrder({
          symbol: 'BTC',
          firstSide: 'BUY',
          firstExecutionType: 'LIMIT',
          firstSize: '0.5',
          firstPrice: '45000.00',
          secondLimitPrice: '46000.00',
          secondStopPrice: '',
          secondSize: '0.5',
        }),
      ).toThrow('IFDOCO requires secondStopPrice field');
    });
  });

  describe('changeOcoOrder', () => {
    it('should change OCO order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12350',
            orderId: '67891',
            symbol: 'BTC',
            side: 'BUY' as const,
            executionType: 'LIMIT' as const,
            size: '0.5',
            price: '46500.00',
            status: 'WAITING' as const,
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.changeOcoOrder({
        rootOrderId: '12350',
        limitPrice: '46500.00',
        stopPrice: '41500.00',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].rootOrderId).toBe('12350');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.getAssets()).rejects.toThrow('Network timeout');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(client.getAssets()).rejects.toThrow();
    });

    it('should handle rate limit errors', async () => {
      const mockErrorResponse = {
        status: 1,
        data: { code: 'ERR_RATE_LIMIT', message: 'Rate limit exceeded' },
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(client.getAssets()).rejects.toThrow();
    });
  });
});
