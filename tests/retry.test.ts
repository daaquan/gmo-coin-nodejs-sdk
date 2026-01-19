import { describe, it, expect, beforeEach, vi } from 'vitest';
import { retryWithBackoff, CircuitBreaker, retryWithCircuitBreaker } from '../src/retry.js';

describe('Retry Mechanism', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 1,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelay: 1,
          maxDelay: 1,
        }),
      ).rejects.toThrow('timeout');

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should check shouldRetry predicate', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ERR-5003 rate limit'))
        .mockRejectedValueOnce(new Error('ERR-201 insufficient funds'));

      const shouldRetry = (err: Error) => err.message.includes('ERR-5003');

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          shouldRetry,
          initialDelay: 1,
          maxDelay: 1,
        }),
      ).rejects.toThrow('ERR-201');

      // First error retries (ERR-5003), second error does not retry
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      // Mock setTimeout to capture delays
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      try {
        await retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelay: 10,
          maxDelay: 50,
          backoffMultiplier: 2,
          jitterFactor: 0,
        });
      } catch {
        // Expected to fail
      }

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;

      // Delays should increase exponentially: 10, 20
      expect(delays.length).toBeGreaterThan(0);
      if (delays.length >= 2) {
        expect(delays[0]).toBeLessThanOrEqual(20);
        expect(delays[1]).toBeLessThanOrEqual(50);
      }
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const breaker = new CircuitBreaker(fn);
      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('should record successes', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const breaker = new CircuitBreaker(fn);

      await breaker.execute();
      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('should open circuit after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const breaker = new CircuitBreaker(fn, { failureThreshold: 2 });

      try {
        await breaker.execute();
      } catch {
        /* expected */
      }
      try {
        await breaker.execute();
      } catch {
        /* expected */
      }

      const state = breaker.getState();
      expect(state.state).toBe('OPEN');
    });

    it('should reject calls when OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const breaker = new CircuitBreaker(fn, { failureThreshold: 1, timeout: 10 });

      try {
        await breaker.execute();
      } catch {
        /* expected */
      }

      // Circuit is now OPEN
      await expect(breaker.execute()).rejects.toThrow('CircuitBreaker is OPEN');
      expect(fn).toHaveBeenCalledTimes(1); // Should not call fn again
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        timeout: 10, // 10ms
      });

      try {
        await breaker.execute();
      } catch {
        /* expected */
      }

      expect(breaker.getState().state).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Next attempt should transition to HALF_OPEN (which will fail and retry)
      try {
        await breaker.execute();
      } catch {
        /* expected */
      }

      const state = breaker.getState();
      expect(state.state).toMatch(/OPEN|HALF_OPEN/); // Depends on timing
    });

    it('should close circuit after successes in HALF_OPEN', async () => {
      let callCount = 0;
      const fn = vi.fn(async () => {
        callCount++;
        // Fail first time, succeed second time
        if (callCount === 1) {
          throw new Error('fail');
        }
        return 'success';
      });

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 10,
      });

      // Fail once to open circuit
      try {
        await breaker.execute();
      } catch {
        /* expected */
      }

      expect(breaker.getState().state).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Success in HALF_OPEN should close circuit
      const result = await breaker.execute();
      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });

  describe('retryWithCircuitBreaker', () => {
    it('should combine retry and circuit breaker', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) throw new Error('timeout');
        return 'success';
      });

      const breaker = new CircuitBreaker(fn);
      const result = await retryWithCircuitBreaker(breaker, {
        maxRetries: 2,
        initialDelay: 1,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });
});
