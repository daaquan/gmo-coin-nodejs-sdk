import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FxPrivateRestClient } from '../src/rest.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock rate limiter
vi.mock('../src/rateLimiter.js', () => ({
  getGate: { wait: vi.fn().mockResolvedValue(undefined) },
  postGate: { wait: vi.fn().mockResolvedValue(undefined) },
}));

describe('FxPrivateRestClient', () => {
  let client: FxPrivateRestClient;
  const mockApiKey = 'test-api-key';
  const mockSecret = 'test-secret';

  beforeEach(() => {
    client = new FxPrivateRestClient(mockApiKey, mockSecret);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new FxPrivateRestClient('', mockSecret)).toThrow(
        'FxPrivateRestClient: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.'
      );
    });

    it('should throw error if secret is missing', () => {
      expect(() => new FxPrivateRestClient(mockApiKey, '')).toThrow(
        'FxPrivateRestClient: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.'
      );
    });

    it('should create client with valid credentials', () => {
      expect(client).toBeInstanceOf(FxPrivateRestClient);
    });
  });

  describe('getAssets', () => {
    it('should return assets on successful response', async () => {
      const mockResponse = {
        status: 0,
        data: {
          equity: '1000000',
          availableAmount: '900000',
          balance: '1000000',
          estimatedTradeFee: '0',
          margin: '100000',
          marginRatio: '10',
          positionLossGain: '0',
          totalSwap: '0',
          transferableAmount: '900000',
        },
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getAssets();
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on API error response', async () => {
      const mockErrorResponse = {
        status: 1,
        data: { code: 'ERR_AUTH', message: 'Authentication failed' },
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(client.getAssets()).rejects.toThrow(/Authentication failed/);
    });
  });

  describe('placeOrder', () => {
    it('should place LIMIT order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: 12345,
            orderId: 67890,
            symbol: 'USD_JPY',
            side: 'BUY' as const,
            orderType: 'NORMAL' as const,
            executionType: 'LIMIT' as const,
            settleType: 'OPEN' as const,
            size: '10000',
            price: '130.00',
            status: 'WAITING' as const,
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'LIMIT' as const,
        limitPrice: '130.00',
      };

      const result = await client.placeOrder(orderReq);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for LIMIT order without limitPrice', async () => {
      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'LIMIT' as const,
      };

      expect(() => client.placeOrder(orderReq)).toThrow('LIMIT requires limitPrice');
    });

    it('should throw error for STOP order without stopPrice', async () => {
      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'STOP' as const,
      };

      expect(() => client.placeOrder(orderReq)).toThrow('STOP requires stopPrice');
    });

    it('should place OCO order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: 12345,
            orderId: 67890,
            symbol: 'USD_JPY',
            side: 'BUY' as const,
            orderType: 'NORMAL' as const,
            executionType: 'OCO' as const,
            settleType: 'OPEN' as const,
            size: '10000',
            price: '130.00',
            status: 'WAITING' as const,
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'OCO' as const,
        oco: { limitPrice: '131.00', stopPrice: '129.00' },
      };

      const result = await client.placeOrder(orderReq);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for OCO order without oco.limitPrice', async () => {
      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'OCO' as const,
        oco: { stopPrice: '129.00' },
      };

      expect(() => client.placeOrder(orderReq)).toThrow('OCO requires oco.limitPrice and oco.stopPrice');
    });

    it('should throw error for OCO order without oco.stopPrice', async () => {
      const orderReq = {
        symbol: 'USD_JPY',
        side: 'BUY' as const,
        size: '10000',
        executionType: 'OCO' as const,
        oco: { limitPrice: '131.00' },
      };

      expect(() => client.placeOrder(orderReq)).toThrow('OCO requires oco.limitPrice and oco.stopPrice');
    });
  });

  describe('cancelOrders', () => {
    it('should cancel orders successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [],
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.cancelOrders({ rootOrderIds: [12345] });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('closeOrder', () => {
    it('should throw error if no settlePosition provided', async () => {
      const orderReq = {
        symbol: 'USD_JPY',
        side: 'SELL' as const,
        executionType: 'LIMIT' as const,
        limitPrice: '130.00',
        settlePosition: [],
      };

      expect(() => client.closeOrder(orderReq)).toThrow('closeOrder requires at least one settlePosition');
    });
  });

  describe('placeIfdOrder', () => {
    it('should place IFD order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: 12345,
            orderId: 67890,
            symbol: 'USD_JPY',
            side: 'BUY' as const,
            orderType: 'IFD' as const,
            executionType: 'LIMIT' as const,
            settleType: 'OPEN' as const,
            size: '10000',
            price: '130.00',
            status: 'WAITING' as const,
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const ifdOrderReq = {
        symbol: 'USD_JPY',
        firstSide: 'BUY' as const,
        firstExecutionType: 'LIMIT' as const,
        firstSize: '10000',
        firstPrice: '130.00',
        secondExecutionType: 'LIMIT' as const,
        secondSize: '10000',
        secondPrice: '131.00',
      };

      const result = await client.placeIfdOrder(ifdOrderReq);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for IFD order with invalid first execution type', async () => {
      const ifdOrderReq = {
        symbol: 'USD_JPY',
        firstSide: 'BUY' as const,
        firstExecutionType: 'LIMIT' as const,
        firstSize: '10000',
        secondExecutionType: 'LIMIT' as const,
        secondSize: '10000',
        secondPrice: '131.00',
      };

      expect(() => client.placeIfdOrder(ifdOrderReq)).toThrow('LIMIT requires limitPrice');
    });
  });

  describe('placeIfdocoOrder', () => {
    it('should place IFDOCO order successfully', async () => {
      const mockResponse = {
        status: 0,
        data: [
          {
            rootOrderId: 12345,
            orderId: 67890,
            symbol: 'USD_JPY',
            side: 'BUY' as const,
            orderType: 'IFDOCO' as const,
            executionType: 'LIMIT' as const,
            settleType: 'OPEN' as const,
            size: '10000',
            price: '130.00',
            status: 'WAITING' as const,
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
        responsetime: '2023-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const ifdocoOrderReq = {
        symbol: 'USD_JPY',
        firstSide: 'BUY' as const,
        firstExecutionType: 'LIMIT' as const,
        firstSize: '10000',
        firstPrice: '130.00',
        secondExecutionType: 'LIMIT' as const,
        secondLimitPrice: '131.00',
        secondStopPrice: '129.00',
        secondSize: '10000',
      };

      const result = await client.placeIfdocoOrder(ifdocoOrderReq);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for IFDOCO order without secondLimitPrice', async () => {
      const ifdocoOrderReq = {
        symbol: 'USD_JPY',
        firstSide: 'BUY' as const,
        firstExecutionType: 'LIMIT' as const,
        firstSize: '10000',
        firstPrice: '130.00',
        secondExecutionType: 'LIMIT' as const,
        secondStopPrice: '129.00',
        secondSize: '10000',
      };

      expect(() => client.placeIfdocoOrder(ifdocoOrderReq)).toThrow('IFDOCO requires secondLimitPrice and secondStopPrice');
    });
  });
});