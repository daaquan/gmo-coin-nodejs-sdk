/**
 * Tests for service/lib/rateLimiter.ts
 * Redis-backed rate limiter with fallback to in-process
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, createMockReply, createMockRedis } from './helpers/mockTypes.js';

// Mock redis module
let mockRedisClient: ReturnType<typeof createMockRedis> | null;
const mockGetRedis = vi.fn();
const mockEnsureRedisConnected = vi.fn();

vi.mock('../service/lib/redis.js', () => ({
  getRedis: () => mockGetRedis(),
  ensureRedisConnected: () => mockEnsureRedisConnected(),
}));

// Mock src/rateLimiter gates
const mockGetGateWait = vi.fn();
const mockPostGateWait = vi.fn();
const mockWsGateWait = vi.fn();

vi.mock('../src/rateLimiter.js', () => ({
  getGate: { wait: () => mockGetGateWait() },
  postGate: { wait: () => mockPostGateWait() },
  wsGate: { wait: () => mockWsGateWait() },
}));

describe('Service Rate Limiter', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRedisClient = null;
    mockGetRedis.mockReturnValue(null);
    mockEnsureRedisConnected.mockResolvedValue(undefined);
    mockGetGateWait.mockResolvedValue(undefined);
    mockPostGateWait.mockResolvedValue(undefined);
    mockWsGateWait.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Without Redis (fallback mode)', () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(null);
    });

    describe('gmoGetGate', () => {
      it('should fallback to src/rateLimiter.getGate.wait()', async () => {
        const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoGetGate(req as any, reply as any);

        expect(mockGetGateWait).toHaveBeenCalled();
      });
    });

    describe('gmoPostGate', () => {
      it('should fallback to src/rateLimiter.postGate.wait()', async () => {
        const { gmoPostGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoPostGate(req as any, reply as any);

        expect(mockPostGateWait).toHaveBeenCalled();
      });
    });

    describe('gmoWsGate', () => {
      it('should fallback to src/rateLimiter.wsGate.wait()', async () => {
        const { gmoWsGate } = await import('../service/lib/rateLimiter.js');

        await gmoWsGate();

        expect(mockWsGateWait).toHaveBeenCalled();
      });
    });
  });

  describe('With Redis', () => {
    beforeEach(() => {
      mockRedisClient = createMockRedis();
      mockGetRedis.mockReturnValue(mockRedisClient);
    });

    describe('gmoGetGate', () => {
      it('should use Redis rate limiting with limit 6', async () => {
        mockRedisClient!.incr.mockResolvedValue(1);
        mockRedisClient!.expire.mockResolvedValue(1);

        const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoGetGate(req as any, reply as any);

        expect(mockRedisClient!.incr).toHaveBeenCalledWith(expect.stringContaining('gmo:rl:get:'));
        expect(mockGetGateWait).not.toHaveBeenCalled();
      });

      it('should set expire on first request in window', async () => {
        mockRedisClient!.incr.mockResolvedValue(1);
        mockRedisClient!.expire.mockResolvedValue(1);

        const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoGetGate(req as any, reply as any);

        expect(mockRedisClient!.expire).toHaveBeenCalledWith(expect.any(String), 2);
      });

      it('should not set expire on subsequent requests in window', async () => {
        mockRedisClient!.incr.mockResolvedValue(3); // Not first request

        const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoGetGate(req as any, reply as any);

        expect(mockRedisClient!.expire).not.toHaveBeenCalled();
      });

      it('should call ensureRedisConnected', async () => {
        mockRedisClient!.incr.mockResolvedValue(1);

        const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoGetGate(req as any, reply as any);

        expect(mockEnsureRedisConnected).toHaveBeenCalled();
      });
    });

    describe('gmoPostGate', () => {
      it('should use Redis rate limiting with limit 1', async () => {
        mockRedisClient!.incr.mockResolvedValue(1);
        mockRedisClient!.expire.mockResolvedValue(1);

        const { gmoPostGate } = await import('../service/lib/rateLimiter.js');
        const req = createMockRequest();
        const reply = createMockReply();

        await gmoPostGate(req as any, reply as any);

        expect(mockRedisClient!.incr).toHaveBeenCalledWith(expect.stringContaining('gmo:rl:post:'));
      });
    });

    describe('gmoWsGate', () => {
      it('should use Redis rate limiting with limit 1', async () => {
        mockRedisClient!.incr.mockResolvedValue(1);
        mockRedisClient!.expire.mockResolvedValue(1);

        const { gmoWsGate } = await import('../service/lib/rateLimiter.js');

        await gmoWsGate();

        expect(mockRedisClient!.incr).toHaveBeenCalledWith(expect.stringContaining('gmo:rl:ws:'));
      });
    });
  });

  describe('Rate limit exceeded behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockRedisClient = createMockRedis();
      mockGetRedis.mockReturnValue(mockRedisClient);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should wait until next window when over limit', async () => {
      // First call exceeds limit, second succeeds
      mockRedisClient!.incr
        .mockResolvedValueOnce(7) // Over limit (>6)
        .mockResolvedValueOnce(1); // Under limit
      mockRedisClient!.expire.mockResolvedValue(1);

      const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
      const req = createMockRequest();
      const reply = createMockReply();

      const gatePromise = gmoGetGate(req as any, reply as any);

      // Advance to next second
      await vi.advanceTimersByTimeAsync(1000);
      await gatePromise;

      // Should have called incr twice (first over, second under)
      expect(mockRedisClient!.incr).toHaveBeenCalledTimes(2);
    });
  });

  describe('Redis key format', () => {
    beforeEach(() => {
      mockRedisClient = createMockRedis();
      mockGetRedis.mockReturnValue(mockRedisClient);
      mockRedisClient!.incr.mockResolvedValue(1);
      mockRedisClient!.expire.mockResolvedValue(1);
    });

    it('should use second-based key suffix', async () => {
      const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
      const req = createMockRequest();
      const reply = createMockReply();

      await gmoGetGate(req as any, reply as any);

      const callArg = mockRedisClient!.incr.mock.calls[0][0];
      // Key format: gmo:rl:get:{seconds}
      expect(callArg).toMatch(/^gmo:rl:get:\d+$/);
    });

    it('should use different keys for different verbs', async () => {
      const { gmoGetGate, gmoPostGate, gmoWsGate } = await import('../service/lib/rateLimiter.js');
      const req = createMockRequest();
      const reply = createMockReply();

      await gmoGetGate(req as any, reply as any);
      await gmoPostGate(req as any, reply as any);
      await gmoWsGate();

      const getKey = mockRedisClient!.incr.mock.calls[0][0];
      const postKey = mockRedisClient!.incr.mock.calls[1][0];
      const wsKey = mockRedisClient!.incr.mock.calls[2][0];

      expect(getKey).toContain('gmo:rl:get:');
      expect(postKey).toContain('gmo:rl:post:');
      expect(wsKey).toContain('gmo:rl:ws:');
    });
  });

  describe('TTL behavior', () => {
    beforeEach(() => {
      mockRedisClient = createMockRedis();
      mockGetRedis.mockReturnValue(mockRedisClient);
    });

    it('should set 2 second TTL for safety margin', async () => {
      mockRedisClient!.incr.mockResolvedValue(1);
      mockRedisClient!.expire.mockResolvedValue(1);

      const { gmoGetGate } = await import('../service/lib/rateLimiter.js');
      const req = createMockRequest();
      const reply = createMockReply();

      await gmoGetGate(req as any, reply as any);

      expect(mockRedisClient!.expire).toHaveBeenCalledWith(expect.any(String), 2);
    });
  });
});
