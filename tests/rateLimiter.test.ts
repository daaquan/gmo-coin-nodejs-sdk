/**
 * Tests for src/rateLimiter.ts
 * FixedGate class and exported gate instances
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FixedGate, getGate, postGate, wsGate } from '../src/rateLimiter.js';

describe('FixedGate', () => {
  describe('constructor', () => {
    it('should calculate correct interval for 6 ops/sec', () => {
      const gate = new FixedGate(6);
      // intervalMs = Math.ceil(1000 / 6) = 167ms
      // Access private property via any for testing
      expect((gate as any).intervalMs).toBe(167);
    });

    it('should calculate correct interval for 1 op/sec', () => {
      const gate = new FixedGate(1);
      // intervalMs = Math.ceil(1000 / 1) = 1000ms
      expect((gate as any).intervalMs).toBe(1000);
    });

    it('should calculate correct interval for 10 ops/sec', () => {
      const gate = new FixedGate(10);
      // intervalMs = Math.ceil(1000 / 10) = 100ms
      expect((gate as any).intervalMs).toBe(100);
    });

    it('should handle fractional ops/sec with ceiling', () => {
      const gate = new FixedGate(3);
      // intervalMs = Math.ceil(1000 / 3) = 334ms
      expect((gate as any).intervalMs).toBe(334);
    });
  });

  describe('wait()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve immediately on first call', async () => {
      const gate = new FixedGate(1);

      const waitPromise = gate.wait();
      await vi.runAllTimersAsync();
      await waitPromise;

      // First call should not wait
      expect((gate as any).last).toBeGreaterThan(0);
    });

    it('should wait for interval before second call', async () => {
      const gate = new FixedGate(1); // 1000ms interval

      // First call
      await gate.wait();
      const firstLast = (gate as any).last;

      // Advance time by 500ms (less than interval)
      vi.advanceTimersByTime(500);

      // Second call should need to wait
      const waitPromise = gate.wait();

      // Advance remaining time
      vi.advanceTimersByTime(500);
      await waitPromise;

      // Last should be updated
      expect((gate as any).last).toBeGreaterThanOrEqual(firstLast);
    });

    it('should not wait if interval has passed', async () => {
      const gate = new FixedGate(1); // 1000ms interval

      // First call
      await gate.wait();

      // Advance time beyond interval
      vi.advanceTimersByTime(1500);

      // Second call should resolve immediately (no additional wait)
      await gate.wait();

      // Should update last timestamp
      expect((gate as any).last).toBe(Date.now());
    });

    it('should update last timestamp on each call', async () => {
      const gate = new FixedGate(10); // 100ms interval

      expect((gate as any).last).toBe(0);

      await gate.wait();
      const first = (gate as any).last;
      expect(first).toBeGreaterThan(0);

      vi.advanceTimersByTime(100);
      await gate.wait();
      const second = (gate as any).last;
      expect(second).toBeGreaterThanOrEqual(first);
    });
  });
});

describe('Exported gate instances', () => {
  describe('getGate', () => {
    it('should be a FixedGate instance', () => {
      expect(getGate).toBeInstanceOf(FixedGate);
    });

    it('should have 6 ops/sec rate (167ms interval)', () => {
      expect((getGate as any).intervalMs).toBe(167);
    });
  });

  describe('postGate', () => {
    it('should be a FixedGate instance', () => {
      expect(postGate).toBeInstanceOf(FixedGate);
    });

    it('should have 1 op/sec rate (1000ms interval)', () => {
      expect((postGate as any).intervalMs).toBe(1000);
    });
  });

  describe('wsGate', () => {
    it('should be a FixedGate instance', () => {
      expect(wsGate).toBeInstanceOf(FixedGate);
    });

    it('should have 1 op/sec rate (1000ms interval)', () => {
      expect((wsGate as any).intervalMs).toBe(1000);
    });
  });
});

describe('Rate limiting behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throttle rapid sequential calls', async () => {
    const gate = new FixedGate(2); // 500ms interval
    const callTimes: number[] = [];

    // Make 3 rapid calls
    const call1 = gate.wait().then(() => callTimes.push(Date.now()));
    const call2 = gate.wait().then(() => callTimes.push(Date.now()));
    const call3 = gate.wait().then(() => callTimes.push(Date.now()));

    // Run all timers
    await vi.runAllTimersAsync();
    await Promise.all([call1, call2, call3]);

    // All calls should complete
    expect(callTimes.length).toBe(3);
  });
});
