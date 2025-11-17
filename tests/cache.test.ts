import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TtlCache, createCacheKey } from '../src/cache.js';
import { FxPublicRestClient, CryptoPublicRestClient } from '../src/rest-public.js';

describe('TtlCache', () => {
  let cache: TtlCache;

  beforeEach(() => {
    cache = new TtlCache({ ttl: 1000, maxSize: 100 });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('should support different types', () => {
      const obj = { a: 1, b: 2 };
      cache.set('obj', obj);
      expect(cache.get('obj')).toEqual(obj);

      const arr = [1, 2, 3];
      cache.set('arr', arr);
      expect(cache.get('arr')).toEqual(arr);

      cache.set('num', 42);
      expect(cache.get('num')).toBe(42);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new TtlCache({ ttl: 50 });
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortCache.get('key1')).toBeUndefined();
    });

    it('should support custom TTL for individual entries', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      cache.set('key2', 'value2', 5000); // 5s TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should not expire entries before TTL', async () => {
      cache.set('key1', 'value1', 200);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('Cache Lookup', () => {
    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      const shortCache = new TtlCache({ ttl: 50 });
      shortCache.set('key1', 'value1');

      expect(shortCache.has('key1')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortCache.has('key1')).toBe(false);
    });
  });

  describe('Cache Deletion', () => {
    it('should delete a key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('missing')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('Cache Size', () => {
    it('should track cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });

    it('should evict oldest entry when max size exceeded', () => {
      const smallCache = new TtlCache({ ttl: 10000, maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      expect(smallCache.size()).toBe(3);

      // Add fourth entry - should evict oldest (key1)
      smallCache.set('key4', 'value4');

      expect(smallCache.size()).toBe(3);
      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });
  });

  describe('Cache Keys', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('Cache Cleanup', () => {
    it('should clean up expired entries', async () => {
      const testCache = new TtlCache({ ttl: 50 });

      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Both entries should be expired
      const cleaned = testCache.cleanup();
      expect(cleaned).toBe(2);
      expect(testCache.size()).toBe(0);
    });

    it('should not remove non-expired entries during cleanup', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2', 5000);

      await new Promise(resolve => setTimeout(resolve, 100));

      const cleaned = cache.cleanup();
      expect(cleaned).toBe(0);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });
});

describe('Cache Key Generation', () => {
  it('should create consistent cache keys', () => {
    const key1 = createCacheKey('ticker', ['USD_JPY']);
    const key2 = createCacheKey('ticker', ['USD_JPY']);

    expect(key1).toBe(key2);
  });

  it('should differentiate different arguments', () => {
    const key1 = createCacheKey('ticker', ['USD_JPY']);
    const key2 = createCacheKey('ticker', ['EUR_JPY']);

    expect(key1).not.toBe(key2);
  });

  it('should handle object arguments', () => {
    const key1 = createCacheKey('order', [{ symbol: 'BTC', size: '1.0' }]);
    const key2 = createCacheKey('order', [{ symbol: 'BTC', size: '1.0' }]);

    expect(key1).toBe(key2);
  });

  it('should differentiate different object arguments', () => {
    const key1 = createCacheKey('order', [{ symbol: 'BTC', size: '1.0' }]);
    const key2 = createCacheKey('order', [{ symbol: 'ETH', size: '0.1' }]);

    expect(key1).not.toBe(key2);
  });

  it('should include namespace in cache key', () => {
    const key1 = createCacheKey('ticker', ['USD_JPY']);
    const key2 = createCacheKey('orderbook', ['USD_JPY']);

    expect(key1).toContain('ticker');
    expect(key2).toContain('orderbook');
    expect(key1).not.toBe(key2);
  });
});

describe('Public API Caching', () => {
  let fxClient: FxPublicRestClient;
  let cryptoClient: CryptoPublicRestClient;

  beforeEach(() => {
    fxClient = new FxPublicRestClient('https://mock.test/forex');
    cryptoClient = new CryptoPublicRestClient('https://mock.test/crypto');

    // Mock fetch
    global.fetch = vi.fn();
  });

  describe('FX Client Caching', () => {
    it('should cache ticker results', async () => {
      const mockResp = {
        status: 0,
        data: { symbol: 'USD_JPY', bid: '150.00', ask: '150.10', high: '151.00', low: '149.00', volume: '1000000', timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // First call should hit the API
      const result1 = await fxClient.getTicker('USD_JPY');
      expect(result1.data.symbol).toBe('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Second call should use cache
      const result2 = await fxClient.getTicker('USD_JPY');
      expect(result2.data.symbol).toBe('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(1); // Still only 1 call

      // Verify cached result is the same
      expect(result2).toBe(result1);
    });

    it('should cache orderbook results', async () => {
      const mockResp = {
        status: 0,
        data: { symbol: 'USD_JPY', bids: [['150.00', '1000']], asks: [['150.10', '1000']], timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // First call
      const result1 = await fxClient.getOrderBook('USD_JPY', '20');
      expect(result1.data.symbol).toBe('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Second call should use cache
      const result2 = await fxClient.getOrderBook('USD_JPY', '20');
      expect((global.fetch as any).mock.calls).toHaveLength(1); // Still only 1 call
      expect(result2).toBe(result1);
    });

    it('should use separate cache for different symbols', async () => {
      const usdResp = {
        status: 0,
        data: { symbol: 'USD_JPY', bid: '150.00', ask: '150.10', high: '151.00', low: '149.00', volume: '1000000', timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      const eurResp = {
        status: 0,
        data: { symbol: 'EUR_JPY', bid: '160.00', ask: '160.10', high: '161.00', low: '159.00', volume: '1000000', timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      let callCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: true, status: 200, json: async () => usdResp };
        } else {
          return { ok: true, status: 200, json: async () => eurResp };
        }
      });

      // Get USD_JPY ticker
      const result1 = await fxClient.getTicker('USD_JPY');
      expect(result1.data.symbol).toBe('USD_JPY');

      // Get EUR_JPY ticker
      const result2 = await fxClient.getTicker('EUR_JPY');
      expect(result2.data.symbol).toBe('EUR_JPY');

      expect((global.fetch as any).mock.calls).toHaveLength(2);

      // Both should be cached now
      const result1Again = await fxClient.getTicker('USD_JPY');
      const result2Again = await fxClient.getTicker('EUR_JPY');

      expect((global.fetch as any).mock.calls).toHaveLength(2); // Still only 2 calls
      expect(result1Again).toBe(result1);
      expect(result2Again).toBe(result2);
    });

    it('should respect custom cache TTL', async () => {
      const shortTtlClient = new FxPublicRestClient('https://mock.test/forex', 50); // 50ms TTL

      const mockResp = {
        status: 0,
        data: { symbol: 'USD_JPY', bid: '150.00', ask: '150.10', high: '151.00', low: '149.00', volume: '1000000', timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // First call
      await shortTtlClient.getTicker('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Second call immediately (should use cache)
      await shortTtlClient.getTicker('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Third call (cache expired, should hit API)
      await shortTtlClient.getTicker('USD_JPY');
      expect((global.fetch as any).mock.calls).toHaveLength(2);
    });
  });

  describe('Crypto Client Caching', () => {
    it('should cache ticker results', async () => {
      const mockResp = {
        status: 0,
        data: { symbol: 'BTC', bid: '50000', ask: '50100', high: '51000', low: '49000', volume: '1000', timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // First call
      const result1 = await cryptoClient.getTicker('BTC');
      expect(result1.data.symbol).toBe('BTC');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Second call should use cache
      const result2 = await cryptoClient.getTicker('BTC');
      expect((global.fetch as any).mock.calls).toHaveLength(1);
      expect(result2).toBe(result1);
    });

    it('should cache orderbook results', async () => {
      const mockResp = {
        status: 0,
        data: { symbol: 'ETH', bids: [['3000', '10']], asks: [['3010', '10']], timestamp: '2024-01-01T00:00:00Z' },
        responsetime: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResp
      });

      // First call
      const result1 = await cryptoClient.getOrderBook('ETH');
      expect((global.fetch as any).mock.calls).toHaveLength(1);

      // Second call should use cache
      const result2 = await cryptoClient.getOrderBook('ETH');
      expect((global.fetch as any).mock.calls).toHaveLength(1);
      expect(result2).toBe(result1);
    });
  });
});
