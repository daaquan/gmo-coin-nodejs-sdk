/**
 * Tests for service/lib/redis.ts
 * Redis connection management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ioredis before importing the module
const mockRedisInstance = {
  status: 'wait' as 'wait' | 'ready' | 'end' | 'connecting',
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedisInstance),
}));

describe('Redis module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockRedisInstance.status = 'wait';
    mockRedisInstance.connect.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getRedis', () => {
    it('should return undefined when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getRedis } = await import('../service/lib/redis.js');
      const result = getRedis();
      expect(result).toBeUndefined();
    });

    it('should return Redis instance when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getRedis } = await import('../service/lib/redis.js');
      const result = getRedis();
      expect(result).toBeDefined();
    });

    it('should return cached client on subsequent calls', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getRedis } = await import('../service/lib/redis.js');

      const first = getRedis();
      const second = getRedis();

      expect(first).toBe(second);
    });

    it('should configure lazyConnect: true', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { Redis } = await import('ioredis');
      const { getRedis } = await import('../service/lib/redis.js');

      getRedis();

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          lazyConnect: true,
        }),
      );
    });

    it('should configure maxRetriesPerRequest: 2', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { Redis } = await import('ioredis');
      const { getRedis } = await import('../service/lib/redis.js');

      getRedis();

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          maxRetriesPerRequest: 2,
        }),
      );
    });
  });

  describe('ensureRedisConnected', () => {
    it('should do nothing when no Redis client (REDIS_URL not set)', async () => {
      delete process.env.REDIS_URL;
      const { ensureRedisConnected } = await import('../service/lib/redis.js');

      await ensureRedisConnected();

      expect(mockRedisInstance.connect).not.toHaveBeenCalled();
    });

    it('should call connect() when status is "wait"', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.status = 'wait';

      const { getRedis, ensureRedisConnected } = await import('../service/lib/redis.js');
      getRedis(); // Initialize client

      await ensureRedisConnected();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it('should call connect() when status is "end"', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.status = 'end';

      const { getRedis, ensureRedisConnected } = await import('../service/lib/redis.js');
      getRedis(); // Initialize client

      await ensureRedisConnected();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it('should not call connect() when status is "ready"', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.status = 'ready';

      const { getRedis, ensureRedisConnected } = await import('../service/lib/redis.js');
      getRedis(); // Initialize client

      await ensureRedisConnected();

      expect(mockRedisInstance.connect).not.toHaveBeenCalled();
    });

    it('should not call connect() when status is "connecting"', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.status = 'connecting';

      const { getRedis, ensureRedisConnected } = await import('../service/lib/redis.js');
      getRedis(); // Initialize client

      await ensureRedisConnected();

      expect(mockRedisInstance.connect).not.toHaveBeenCalled();
    });
  });
});
