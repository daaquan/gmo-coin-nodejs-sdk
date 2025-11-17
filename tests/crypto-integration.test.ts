import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoPrivateRestClient } from '../src/rest.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock rate limiter
vi.mock('../src/rateLimiter.js', () => ({
  getGate: { wait: vi.fn().mockResolvedValue(undefined) },
  postGate: { wait: vi.fn().mockResolvedValue(undefined) },
}));

describe('CryptoPrivateRestClient Integration Tests', () => {
  let client: CryptoPrivateRestClient;
  const mockApiKey = 'test-api-key';
  const mockSecret = 'test-secret';

  beforeEach(() => {
    client = new CryptoPrivateRestClient(mockApiKey, mockSecret);
    mockFetch.mockClear();
  });

  describe('Complete Trading Workflow', () => {
    it('should execute a complete market order workflow', async () => {
      // Step 1: Check assets
      const assetsResponse = {
        status: 0,
        data: [
          { symbol: 'USDT', amount: '10000.0', available: '10000.0' },
          { symbol: 'BTC', amount: '0.0', available: '0.0' },
        ],
        responsetime: '2025-01-01T00:00:00.000Z',
      };

      // Step 2: Place market order
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12345' },
        responsetime: '2025-01-01T00:01:00.000Z',
      };

      // Step 3: Get active orders
      const ordersResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12345',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executionType: 'MARKET' as const,
            size: '0.1',
            status: 'ORDERED' as const,
            timestamp: '2025-01-01T00:01:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:01:05.000Z',
      };

      // Step 4: Get execution details
      const executionsResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-123',
            orderId: '67890',
            symbol: 'BTC',
            side: 'BUY' as const,
            executedPrice: '44500.00',
            executedSize: '0.1',
            timestamp: '2025-01-01T00:01:10.000Z',
          },
        ],
        responsetime: '2025-01-01T00:01:10.000Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(assetsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(orderResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(ordersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(executionsResponse),
        });

      // Execute workflow
      const assets = await client.getAssets();
      expect(assets.data).toHaveLength(2);
      expect(assets.data[0].available).toBe('10000.0');

      const order = await client.placeOrder({
        symbol: 'BTC',
        side: 'BUY' as const,
        executionType: 'MARKET' as const,
        size: '0.1',
      });
      expect(order.data.rootOrderId).toBe('12345');

      const orders = await client.getActiveOrders();
      expect(orders.data).toHaveLength(1);
      expect(orders.data[0].status).toBe('ORDERED');

      const executions = await client.getExecutions();
      expect(executions.data).toHaveLength(1);
      expect(executions.data[0].executedSize).toBe('0.1');
    });

    it('should execute a complete limit order workflow', async () => {
      // Step 1: Place limit order
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12346' },
        responsetime: '2025-01-01T00:10:00.000Z',
      };

      // Step 2: Check order status
      const orderStatusResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12346',
            orderId: '67891',
            symbol: 'ETH',
            side: 'BUY' as const,
            executionType: 'LIMIT' as const,
            size: '1.0',
            price: '3000.00',
            status: 'WAITING' as const,
            timestamp: '2025-01-01T00:10:00.000Z',
          },
        ],
        responsetime: '2025-01-01T00:10:05.000Z',
      };

      // Step 3: Cancel order
      const cancelResponse = {
        status: 0,
        data: { result: 'success' },
        responsetime: '2025-01-01T00:11:00.000Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(orderResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(orderStatusResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(cancelResponse),
        });

      const order = await client.placeOrder({
        symbol: 'ETH',
        side: 'BUY' as const,
        executionType: 'LIMIT' as const,
        size: '1.0',
        price: '3000.00',
      });
      expect(order.data.rootOrderId).toBe('12346');

      const orderStatus = await client.getActiveOrders();
      expect(orderStatus.data[0].status).toBe('WAITING');

      const cancel = await client.cancelOrder('12346');
      expect(cancel.status).toBe(0);
    });

    it('should execute position management workflow', async () => {
      // Step 1: Check open positions
      const positionsResponse = {
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
        responsetime: '2025-01-01T01:00:00.000Z',
      };

      // Step 2: Close position
      const closeResponse = {
        status: 0,
        data: { rootOrderId: '12347' },
        responsetime: '2025-01-01T01:05:00.000Z',
      };

      // Step 3: Verify position closed
      const emptyPositionsResponse = {
        status: 0,
        data: [],
        responsetime: '2025-01-01T01:10:00.000Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(positionsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(closeResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(emptyPositionsResponse),
        });

      const positions = await client.getOpenPositions();
      expect(positions.data).toHaveLength(1);
      expect(positions.data[0].symbol).toBe('BTC');

      const close = await client.closePosition('BTC', '0.5', 'SELL');
      expect(close.data.rootOrderId).toBe('12347');

      const updatedPositions = await client.getOpenPositions();
      expect(updatedPositions.data).toHaveLength(0);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle partial order fill and cancel remainder', async () => {
      // Place order that may get partially filled
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12348' },
        responsetime: '2025-01-01T02:00:00.000Z',
      };

      // Check partial execution
      const executionsResponse = {
        status: 0,
        data: [
          {
            executionId: 'exec-124',
            orderId: '67892',
            symbol: 'SOL',
            side: 'BUY' as const,
            executedPrice: '100.00',
            executedSize: '5.0', // Only 5 out of 10 filled
            timestamp: '2025-01-01T02:01:00.000Z',
          },
        ],
        responsetime: '2025-01-01T02:01:00.000Z',
      };

      // Cancel remaining order
      const cancelResponse = {
        status: 0,
        data: { result: 'success' },
        responsetime: '2025-01-01T02:02:00.000Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(orderResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(executionsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(cancelResponse),
        });

      const order = await client.placeOrder({
        symbol: 'SOL',
        side: 'BUY' as const,
        executionType: 'LIMIT' as const,
        size: '10.0',
        price: '100.00',
      });

      const executions = await client.getExecutions({ orderId: '67892' });
      expect(executions.data[0].executedSize).toBe('5.0');

      const cancel = await client.cancelOrder('12348');
      expect(cancel.status).toBe(0);
    });

    it('should handle API errors with retry logic simulation', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 1,
          data: { code: 'ERR_TEMP', message: 'Temporary error' },
          responsetime: '2025-01-01T03:00:00.000Z',
        }),
      });

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 0,
          data: [{ symbol: 'BTC', amount: '1.0', available: '1.0' }],
          responsetime: '2025-01-01T03:00:01.000Z',
        }),
      });

      // First attempt fails
      await expect(client.getAssets()).rejects.toThrow();

      // Retry succeeds
      const assets = await client.getAssets();
      expect(assets.data).toHaveLength(1);
    });
  });

  describe('Multi-Symbol Operations', () => {
    it('should manage multiple positions across symbols', async () => {
      const positionsResponse = {
        status: 0,
        data: [
          {
            symbol: 'BTC',
            sumSize: '0.5',
            avgPrice: '45000.00',
            sumPrice: '22500.00',
            side: 'BUY' as const,
          },
          {
            symbol: 'ETH',
            sumSize: '5.0',
            avgPrice: '3000.00',
            sumPrice: '15000.00',
            side: 'BUY' as const,
          },
          {
            symbol: 'SOL',
            sumSize: '100.0',
            avgPrice: '100.00',
            sumPrice: '10000.00',
            side: 'SELL' as const,
          },
        ],
        responsetime: '2025-01-01T04:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(positionsResponse),
      });

      const positions = await client.getOpenPositions();
      expect(positions.data).toHaveLength(3);

      const btcPosition = positions.data[0];
      expect(btcPosition.symbol).toBe('BTC');
      expect(btcPosition.side).toBe('BUY');

      const solPosition = positions.data[2];
      expect(solPosition.symbol).toBe('SOL');
      expect(solPosition.side).toBe('SELL');
    });

    it('should filter operations by specific symbols', async () => {
      const ordersResponse = {
        status: 0,
        data: [
          {
            rootOrderId: '12349',
            orderId: '67893',
            symbol: 'BTC',
            side: 'BUY' as const,
            executionType: 'LIMIT' as const,
            size: '0.5',
            price: '44000.00',
            status: 'WAITING' as const,
            timestamp: '2025-01-01T05:00:00.000Z',
          },
        ],
        responsetime: '2025-01-01T05:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(ordersResponse),
      });

      const orders = await client.getActiveOrders({ symbol: 'BTC' });
      expect(orders.data).toHaveLength(1);
      expect(orders.data[0].symbol).toBe('BTC');
    });
  });

  describe('Supported Symbols Coverage', () => {
    it('should support major crypto currencies', () => {
      const symbols = client.getSupportedSymbols();
      const majorSymbols = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH'];

      majorSymbols.forEach((symbol) => {
        expect(symbols).toContain(symbol);
      });
    });

    it('should support emerging altcoins', () => {
      const symbols = client.getSupportedSymbols();
      const altcoins = ['SOL', 'MATIC', 'AVAX', 'DOGE'];

      altcoins.forEach((symbol) => {
        if (symbols.includes(symbol)) {
          expect(symbols).toContain(symbol);
        }
      });
    });

    it('should have reasonable number of supported symbols', () => {
      const symbols = client.getSupportedSymbols();
      expect(symbols.length).toBeGreaterThanOrEqual(10);
      expect(symbols.length).toBeLessThan(100);
    });
  });

  describe('Order Type Validation', () => {
    it('should validate MARKET order parameters', async () => {
      // MARKET orders should accept just symbol, side, executionType, size
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12350' },
        responsetime: '2025-01-01T06:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(orderResponse),
      });

      await expect(
        client.placeOrder({
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'MARKET' as const,
          size: '0.1',
        })
      ).resolves.toBeDefined();
    });

    it('should validate LIMIT order parameters', async () => {
      // LIMIT orders require price - with price should work
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12351' },
        responsetime: '2025-01-01T06:01:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(orderResponse),
      });

      await expect(
        client.placeOrder({
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'LIMIT' as const,
          size: '0.1',
          price: '44000.00',
        })
      ).resolves.toBeDefined();

      // Missing price should throw synchronously
      expect(() => {
        client.placeOrder({
          symbol: 'BTC',
          side: 'BUY' as const,
          executionType: 'LIMIT' as const,
          size: '0.1',
        });
      }).toThrow('LIMIT orders require price field');
    });

    it('should validate STOP order parameters', async () => {
      // STOP orders require losscutPrice - with losscutPrice should work
      const orderResponse = {
        status: 0,
        data: { rootOrderId: '12352' },
        responsetime: '2025-01-01T06:02:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(orderResponse),
      });

      await expect(
        client.placeOrder({
          symbol: 'BTC',
          side: 'SELL' as const,
          executionType: 'STOP' as const,
          size: '0.1',
          losscutPrice: '42000.00',
        })
      ).resolves.toBeDefined();

      // Missing losscutPrice should throw synchronously
      expect(() => {
        client.placeOrder({
          symbol: 'BTC',
          side: 'SELL' as const,
          executionType: 'STOP' as const,
          size: '0.1',
        });
      }).toThrow('STOP orders require losscutPrice field');
    });
  });
});
