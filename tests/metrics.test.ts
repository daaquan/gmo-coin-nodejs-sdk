import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsCollector,
  createMetricsCollector,
  exportPrometheus,
  type AggregatedMetrics,
} from '../src/metrics.js';

describe('Metrics Collector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('Basic Request Recording', () => {
    it('should record successful requests', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 100);

      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should record failed requests', () => {
      collector.recordRequest('GET', '/v1/assets', 500, 150, new Error('Server error'));

      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorRate).toBe(1);
    });

    it('should track multiple requests', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('GET', '/v1/assets', 200, 60);
      collector.recordRequest('POST', '/v1/order', 201, 100);
      collector.recordRequest('POST', '/v1/order', 400, 80, new Error('Invalid order'));

      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorRate).toBeCloseTo(0.25);
    });
  });

  describe('Endpoint-Level Metrics', () => {
    it('should track per-endpoint statistics', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 100);
      collector.recordRequest('GET', '/v1/assets', 200, 110);
      collector.recordRequest('GET', '/v1/assets', 500, 90, new Error('Error'));

      const endpoints = collector.getMetrics().endpoints;
      const assetEndpoint = endpoints.find((e) => e.path === '/v1/assets');

      expect(assetEndpoint).toBeDefined();
      expect(assetEndpoint?.method).toBe('GET');
      expect(assetEndpoint?.requestCount).toBe(3);
      expect(assetEndpoint?.errorCount).toBe(1);
      expect(assetEndpoint?.errorRate).toBeCloseTo(1 / 3);
    });

    it('should track latency statistics', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('GET', '/v1/assets', 200, 100);
      collector.recordRequest('GET', '/v1/assets', 200, 75);

      const endpoints = collector.getMetrics().endpoints;
      const assetEndpoint = endpoints.find((e) => e.path === '/v1/assets');

      expect(assetEndpoint?.latency.min).toBe(50);
      expect(assetEndpoint?.latency.max).toBe(100);
      expect(assetEndpoint?.latency.avg).toBe(75);
      expect(assetEndpoint?.latency.count).toBe(3);
    });

    it('should track different endpoints separately', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('POST', '/v1/order', 201, 100);
      collector.recordRequest('GET', '/v1/openPositions', 200, 75);

      const endpoints = collector.getMetrics().endpoints;
      expect(endpoints).toHaveLength(3);

      const methods = new Set(endpoints.map((e) => e.method));
      expect(methods.has('GET')).toBe(true);
      expect(methods.has('POST')).toBe(true);
    });

    it('should record last error information', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('GET', '/v1/assets', 500, 100, new Error('First error'));
      collector.recordRequest('GET', '/v1/assets', 200, 75);
      collector.recordRequest('GET', '/v1/assets', 503, 80, new Error('Service unavailable'));

      const endpoint = collector.getEndpointMetrics('GET', '/v1/assets');
      expect(endpoint?.lastError).toContain('Service unavailable');
      expect(endpoint?.lastErrorTime).toBeDefined();
    });
  });

  describe('Error Tracking', () => {
    it('should categorize errors by HTTP status code', () => {
      collector.recordRequest('GET', '/v1/assets', 404, 50, new Error('Not found'));
      collector.recordRequest('POST', '/v1/order', 400, 100, new Error('Bad request'));
      collector.recordRequest('GET', '/v1/openPositions', 500, 75, new Error('Server error'));
      collector.recordRequest('POST', '/v1/order', 500, 80, new Error('Server error'));

      const metrics = collector.getMetrics();
      expect(metrics.errors.byType['HTTP_404']).toBe(1);
      expect(metrics.errors.byType['HTTP_400']).toBe(1);
      expect(metrics.errors.byType['HTTP_500']).toBe(2);
    });

    it('should categorize errors by error code', () => {
      collector.recordRequest(
        'GET',
        '/v1/assets',
        400,
        50,
        new Error('ERR-5003 rate limit exceeded'),
      );
      collector.recordRequest(
        'POST',
        '/v1/order',
        400,
        100,
        new Error('ERR-201 insufficient funds'),
      );
      collector.recordRequest(
        'GET',
        '/v1/assets',
        400,
        75,
        new Error('ERR-5003 rate limit exceeded'),
      );

      const metrics = collector.getMetrics();
      expect(metrics.errors.byType['ERR-5003']).toBe(2);
      expect(metrics.errors.byType['ERR-201']).toBe(1);
    });

    it('should track total error count', () => {
      collector.recordRequest('GET', '/v1/assets', 500, 50, new Error('Error 1'));
      collector.recordRequest('GET', '/v1/assets', 500, 60, new Error('Error 2'));
      collector.recordRequest('POST', '/v1/order', 400, 100, new Error('Error 3'));

      const metrics = collector.getMetrics();
      expect(metrics.errors.total).toBe(3);
    });
  });

  describe('Order Tracking', () => {
    it('should track placed orders', () => {
      collector.recordOrder('placed');
      collector.recordOrder('placed');
      collector.recordOrder('placed');

      const metrics = collector.getMetrics();
      expect(metrics.orders.placed).toBe(3);
      expect(metrics.orders.pending).toBe(3);
    });

    it('should track completed orders', () => {
      collector.recordOrder('placed');
      collector.recordOrder('placed');
      collector.recordOrder('completed');

      const metrics = collector.getMetrics();
      expect(metrics.orders.placed).toBe(2);
      expect(metrics.orders.completed).toBe(1);
      expect(metrics.orders.pending).toBe(1);
    });

    it('should track failed orders', () => {
      collector.recordOrder('placed');
      collector.recordOrder('placed');
      collector.recordOrder('failed');

      const metrics = collector.getMetrics();
      expect(metrics.orders.placed).toBe(2);
      expect(metrics.orders.failed).toBe(1);
      expect(metrics.orders.pending).toBe(1);
    });

    it('should handle pending orders correctly', () => {
      collector.recordOrder('placed');
      collector.recordOrder('placed');
      collector.recordOrder('placed');
      collector.recordOrder('completed');
      collector.recordOrder('completed');

      const metrics = collector.getMetrics();
      expect(metrics.orders.pending).toBe(1);
    });

    it('should not allow pending to go negative', () => {
      collector.recordOrder('completed');

      const metrics = collector.getMetrics();
      expect(metrics.orders.pending).toBe(0);
    });
  });

  describe('Execution Tracking', () => {
    it('should track executions', () => {
      collector.recordExecution();
      collector.recordExecution();
      collector.recordExecution('BTC');

      const metrics = collector.getMetrics();
      expect(metrics.executions.total).toBe(3);
    });

    it('should track executions by symbol', () => {
      collector.recordExecution('BTC');
      collector.recordExecution('BTC');
      collector.recordExecution('ETH');
      collector.recordExecution('BTC');

      const metrics = collector.getMetrics();
      expect(metrics.executions.bySymbol['BTC']).toBe(3);
      expect(metrics.executions.bySymbol['ETH']).toBe(1);
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordOrder('placed');
      collector.recordExecution('BTC');

      const before = collector.getMetrics();
      expect(before.totalRequests).toBeGreaterThan(0);

      collector.reset();

      const after = collector.getMetrics();
      expect(after.totalRequests).toBe(0);
      expect(after.orders.placed).toBe(0);
      expect(after.executions.total).toBe(0);
    });
  });

  describe('Metrics Summary', () => {
    it('should generate summary string', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('POST', '/v1/order', 400, 100, new Error('Invalid'));
      collector.recordOrder('placed');
      collector.recordOrder('completed');
      collector.recordExecution('BTC');

      const summary = collector.summary();

      expect(summary).toContain('Uptime:');
      expect(summary).toContain('Total Requests: 2');
      expect(summary).toContain('Total Errors: 1');
      expect(summary).toContain('Orders:');
      expect(summary).toContain('Executions:');
    });
  });

  describe('Uptime Tracking', () => {
    it('should track uptime', async () => {
      const before = collector.getMetrics().uptime;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const after = collector.getMetrics().uptime;

      expect(after).toBeGreaterThanOrEqual(before + 40); // Allow 10ms variance
    });
  });

  describe('Factory Function', () => {
    it('should create new metrics collector', () => {
      const collector1 = createMetricsCollector();
      const collector2 = createMetricsCollector();

      collector1.recordRequest('GET', '/v1/assets', 200, 50);
      collector2.recordRequest('POST', '/v1/order', 201, 100);

      expect(collector1.getMetrics().totalRequests).toBe(1);
      expect(collector2.getMetrics().totalRequests).toBe(1);
    });
  });

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('GET', '/v1/assets', 200, 75);
      collector.recordRequest('POST', '/v1/order', 201, 100);
      collector.recordOrder('placed');
      collector.recordExecution('BTC');

      const prometheus = exportPrometheus(collector.getMetrics());

      expect(prometheus).toContain('# HELP api_requests_total');
      expect(prometheus).toContain('api_requests_total');
      expect(prometheus).toContain('api_errors_total');
      expect(prometheus).toContain('api_request_latency_ms');
      expect(prometheus).toContain('orders_placed_total');
      expect(prometheus).toContain('executions_total');
      expect(prometheus).toContain('GET');
      expect(prometheus).toContain('POST');
    });

    it('should include endpoint metrics in Prometheus', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('POST', '/v1/order', 201, 100);

      const prometheus = exportPrometheus(collector.getMetrics());

      expect(prometheus).toContain('method="GET"');
      expect(prometheus).toContain('method="POST"');
      expect(prometheus).toContain('path="/v1/assets"');
      expect(prometheus).toContain('path="/v1/order"');
    });

    it('should include latency quantiles', () => {
      collector.recordRequest('GET', '/v1/assets', 200, 50);
      collector.recordRequest('GET', '/v1/assets', 200, 100);

      const prometheus = exportPrometheus(collector.getMetrics());

      expect(prometheus).toContain('quantile="avg"');
      expect(prometheus).toContain('quantile="min"');
      expect(prometheus).toContain('quantile="max"');
    });

    it('should include execution symbols in Prometheus', () => {
      collector.recordExecution('BTC');
      collector.recordExecution('ETH');

      const prometheus = exportPrometheus(collector.getMetrics());

      expect(prometheus).toContain('symbol="BTC"');
      expect(prometheus).toContain('symbol="ETH"');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero requests gracefully', () => {
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.endpoints).toHaveLength(0);
    });

    it('should handle undefined error messages', () => {
      collector.recordRequest('GET', '/v1/assets', 500, 50);

      const metrics = collector.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });

    it('should handle execution without symbol', () => {
      collector.recordExecution();
      collector.recordExecution();

      const metrics = collector.getMetrics();
      expect(metrics.executions.total).toBe(2);
      expect(Object.keys(metrics.executions.bySymbol)).toHaveLength(0);
    });
  });
});
