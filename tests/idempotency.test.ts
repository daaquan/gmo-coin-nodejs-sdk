/**
 * Tests for service/lib/idempotency.ts
 * Idempotency cache with Redis fallback to in-memory
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEntry, createExpiredEntry } from './helpers/mockTypes.js';

// Mock redis module
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
};

let mockGetRedis: ReturnType<typeof vi.fn>;
let mockEnsureRedisConnected: ReturnType<typeof vi.fn>;

vi.mock('../service/lib/redis.js', () => ({
  getRedis: () => mockGetRedis(),
  ensureRedisConnected: () => mockEnsureRedisConnected(),
}));

describe('Idempotency Cache', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetRedis = vi.fn().mockReturnValue(null);
    mockEnsureRedisConnected = vi.fn().mockResolvedValue(undefined);
    mockRedisClient.get.mockReset();
    mockRedisClient.set.mockReset();
  });

  describe('getIdempotent', () => {
    describe('Without Redis (in-memory fallback)', () => {
      beforeEach(() => {
        mockGetRedis.mockReturnValue(null);
      });

      it('should return undefined for undefined key', async () => {
        const { getIdempotent } = await import('../service/lib/idempotency.js');
        const result = await getIdempotent(undefined);
        expect(result).toBeUndefined();
      });

      it('should return undefined for non-existent key', async () => {
        const { getIdempotent } = await import('../service/lib/idempotency.js');
        const result = await getIdempotent('non-existent-key');
        expect(result).toBeUndefined();
      });

      it('should return stored entry for valid key', async () => {
        const { getIdempotent, setIdempotent } = await import('../service/lib/idempotency.js');

        const entry = { result: 'success' };
        await setIdempotent('test-key', 200, entry);

        const result = await getIdempotent('test-key');
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.body).toEqual(entry);
      });

      it('should delete and return undefined for expired entry', async () => {
        const { getIdempotent, setIdempotent } = await import('../service/lib/idempotency.js');

        // Set entry with very short TTL
        await setIdempotent('expired-key', 200, { result: 'old' }, 1);

        // Wait for expiry
        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = await getIdempotent('expired-key');
        expect(result).toBeUndefined();
      });
    });

    describe('With Redis', () => {
      beforeEach(() => {
        mockGetRedis.mockReturnValue(mockRedisClient);
      });

      it('should call redis.get with prefixed key', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const { getIdempotent } = await import('../service/lib/idempotency.js');
        await getIdempotent('my-key');

        expect(mockRedisClient.get).toHaveBeenCalledWith('idem:my-key');
      });

      it('should call ensureRedisConnected before get', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const { getIdempotent } = await import('../service/lib/idempotency.js');
        await getIdempotent('my-key');

        expect(mockEnsureRedisConnected).toHaveBeenCalled();
      });

      it('should parse JSON response correctly', async () => {
        const entry = createMockEntry(201, { id: 123 });
        mockRedisClient.get.mockResolvedValue(JSON.stringify(entry));

        const { getIdempotent } = await import('../service/lib/idempotency.js');
        const result = await getIdempotent('json-key');

        expect(result).toBeDefined();
        expect(result?.status).toBe(201);
        expect(result?.body).toEqual({ id: 123 });
      });

      it('should return undefined for null Redis response', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const { getIdempotent } = await import('../service/lib/idempotency.js');
        const result = await getIdempotent('null-key');

        expect(result).toBeUndefined();
      });

      it('should return undefined for invalid JSON', async () => {
        mockRedisClient.get.mockResolvedValue('not-valid-json{');

        const { getIdempotent } = await import('../service/lib/idempotency.js');
        const result = await getIdempotent('invalid-json-key');

        expect(result).toBeUndefined();
      });
    });
  });

  describe('setIdempotent', () => {
    describe('Without Redis (in-memory fallback)', () => {
      beforeEach(() => {
        mockGetRedis.mockReturnValue(null);
      });

      it('should store entry with default TTL (10 minutes)', async () => {
        const { setIdempotent, getIdempotent } = await import('../service/lib/idempotency.js');

        await setIdempotent('default-ttl-key', 200, { result: 'ok' });

        const result = await getIdempotent('default-ttl-key');
        expect(result).toBeDefined();
        expect(result?.ttlMs).toBe(10 * 60 * 1000); // 600000ms
      });

      it('should store entry with custom TTL', async () => {
        const { setIdempotent, getIdempotent } = await import('../service/lib/idempotency.js');

        const customTtl = 5 * 60 * 1000; // 5 minutes
        await setIdempotent('custom-ttl-key', 200, { result: 'ok' }, customTtl);

        const result = await getIdempotent('custom-ttl-key');
        expect(result).toBeDefined();
        expect(result?.ttlMs).toBe(customTtl);
      });

      it('should store createdAt timestamp', async () => {
        const { setIdempotent, getIdempotent } = await import('../service/lib/idempotency.js');

        const before = Date.now();
        await setIdempotent('timestamp-key', 200, { result: 'ok' });
        const after = Date.now();

        const result = await getIdempotent('timestamp-key');
        expect(result).toBeDefined();
        expect(result?.createdAt).toBeGreaterThanOrEqual(before);
        expect(result?.createdAt).toBeLessThanOrEqual(after);
      });

      it('should overwrite existing entry', async () => {
        const { setIdempotent, getIdempotent } = await import('../service/lib/idempotency.js');

        await setIdempotent('overwrite-key', 200, { version: 1 });
        await setIdempotent('overwrite-key', 201, { version: 2 });

        const result = await getIdempotent('overwrite-key');
        expect(result?.status).toBe(201);
        expect(result?.body).toEqual({ version: 2 });
      });
    });

    describe('With Redis', () => {
      beforeEach(() => {
        mockGetRedis.mockReturnValue(mockRedisClient);
        mockRedisClient.set.mockResolvedValue('OK');
      });

      it('should call redis.set with prefixed key', async () => {
        const { setIdempotent } = await import('../service/lib/idempotency.js');

        await setIdempotent('redis-key', 200, { result: 'ok' });

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'idem:redis-key',
          expect.any(String),
          'PX',
          expect.any(Number)
        );
      });

      it('should call ensureRedisConnected before set', async () => {
        const { setIdempotent } = await import('../service/lib/idempotency.js');

        await setIdempotent('connect-key', 200, { result: 'ok' });

        expect(mockEnsureRedisConnected).toHaveBeenCalled();
      });

      it('should use PX for millisecond expiry', async () => {
        const { setIdempotent } = await import('../service/lib/idempotency.js');

        const customTtl = 300000; // 5 minutes
        await setIdempotent('px-key', 200, { result: 'ok' }, customTtl);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'idem:px-key',
          expect.any(String),
          'PX',
          customTtl
        );
      });

      it('should serialize entry as JSON', async () => {
        const { setIdempotent } = await import('../service/lib/idempotency.js');

        await setIdempotent('json-key', 200, { complex: { nested: true } });

        const [, jsonString] = mockRedisClient.set.mock.calls[0];
        const parsed = JSON.parse(jsonString);

        expect(parsed.status).toBe(200);
        expect(parsed.body).toEqual({ complex: { nested: true } });
        expect(parsed.createdAt).toBeDefined();
        expect(parsed.ttlMs).toBeDefined();
      });
    });
  });

  describe('Entry type validation', () => {
    it('should have correct Entry type structure', () => {
      const entry = createMockEntry();

      expect(typeof entry.status).toBe('number');
      expect(typeof entry.createdAt).toBe('number');
      expect(typeof entry.ttlMs).toBe('number');
      expect(entry.body).toBeDefined();
    });

    it('should detect expired entries correctly', () => {
      const expired = createExpiredEntry();
      const now = Date.now();

      const isExpired = now - expired.createdAt > expired.ttlMs;
      expect(isExpired).toBe(true);
    });

    it('should detect valid entries correctly', () => {
      const valid = createMockEntry();
      const now = Date.now();

      const isExpired = now - valid.createdAt > valid.ttlMs;
      expect(isExpired).toBe(false);
    });
  });
});
