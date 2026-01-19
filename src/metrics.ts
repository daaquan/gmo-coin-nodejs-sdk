/**
 * Metrics collection for REST API operations
 * Tracks requests, errors, latency, orders, and executions
 */

export interface LatencyStats {
  min: number; // milliseconds
  max: number; // milliseconds
  avg: number; // milliseconds
  total: number; // total time in ms
  count: number; // number of measurements
}

export interface EndpointMetrics {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  requestCount: number;
  errorCount: number;
  errorRate: number; // 0.0 - 1.0
  latency: LatencyStats;
  lastError?: string;
  lastErrorTime?: string;
}

export interface OperationMetrics {
  orders: {
    placed: number;
    completed: number;
    failed: number;
    pending: number;
  };
  executions: {
    total: number;
    bySymbol: Record<string, number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
}

export interface AggregatedMetrics extends OperationMetrics {
  endpoints: EndpointMetrics[];
  uptime: number; // milliseconds
  totalRequests: number;
  totalErrors: number;
  errorRate: number; // 0.0 - 1.0
}

/**
 * Metrics collector for API operations
 * Thread-safe (in-process, single-threaded by nature)
 */
export class MetricsCollector {
  private endpoints: Map<string, EndpointMetrics> = new Map();
  private operationMetrics: OperationMetrics = {
    orders: { placed: 0, completed: 0, failed: 0, pending: 0 },
    executions: { total: 0, bySymbol: {} },
    errors: { total: 0, byType: {} },
  };
  private startTime = Date.now();

  /**
   * Record an API request
   */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    error?: Error | string,
  ): void {
    const key = `${method.toUpperCase()}:${path}`;
    let metrics = this.endpoints.get(key);

    if (!metrics) {
      metrics = {
        path,
        method: method.toUpperCase() as EndpointMetrics['method'],
        requestCount: 0,
        errorCount: 0,
        errorRate: 0,
        latency: { min: Infinity, max: 0, avg: 0, total: 0, count: 0 },
      };
      this.endpoints.set(key, metrics);
    }

    // Update request count
    metrics.requestCount += 1;

    // Update latency stats
    metrics.latency.count += 1;
    metrics.latency.total += duration;
    metrics.latency.avg = Math.round(metrics.latency.total / metrics.latency.count);
    metrics.latency.min = Math.min(metrics.latency.min, duration);
    metrics.latency.max = Math.max(metrics.latency.max, duration);

    // Track errors
    if (error || statusCode >= 400) {
      metrics.errorCount += 1;
      metrics.lastError = error instanceof Error ? error.message : String(error);
      metrics.lastErrorTime = new Date().toISOString();
      this.operationMetrics.errors.total += 1;

      // Categorize error by type
      let errorType = `HTTP_${statusCode}`;
      if (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Extract error code if present (e.g., ERR-5003)
        const match = errorMsg.match(/ERR-\d+/);
        if (match) {
          errorType = match[0];
        }
      }

      this.operationMetrics.errors.byType[errorType] =
        (this.operationMetrics.errors.byType[errorType] ?? 0) + 1;
    }

    // Calculate error rate
    metrics.errorRate = metrics.errorCount / metrics.requestCount;
  }

  /**
   * Record an order placement
   */
  recordOrder(status: 'placed' | 'completed' | 'failed' = 'placed'): void {
    if (status === 'placed') {
      this.operationMetrics.orders.placed += 1;
      this.operationMetrics.orders.pending += 1;
    } else if (status === 'completed') {
      this.operationMetrics.orders.completed += 1;
      this.operationMetrics.orders.pending = Math.max(0, this.operationMetrics.orders.pending - 1);
    } else if (status === 'failed') {
      this.operationMetrics.orders.failed += 1;
      this.operationMetrics.orders.pending = Math.max(0, this.operationMetrics.orders.pending - 1);
    }
  }

  /**
   * Record an execution/fill
   */
  recordExecution(symbol?: string): void {
    this.operationMetrics.executions.total += 1;
    if (symbol) {
      this.operationMetrics.executions.bySymbol[symbol] =
        (this.operationMetrics.executions.bySymbol[symbol] ?? 0) + 1;
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): AggregatedMetrics {
    const endpoints = Array.from(this.endpoints.values());
    const totalRequests = endpoints.reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = endpoints.reduce((sum, m) => sum + m.errorCount, 0);

    return {
      ...this.operationMetrics,
      endpoints,
      uptime: Date.now() - this.startTime,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    };
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointMetrics(method: string, path: string): EndpointMetrics | undefined {
    const key = `${method.toUpperCase()}:${path}`;
    return this.endpoints.get(key);
  }

  /**
   * Get operation metrics (orders, executions, errors)
   */
  getOperationMetrics(): OperationMetrics {
    return { ...this.operationMetrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.endpoints.clear();
    this.operationMetrics = {
      orders: { placed: 0, completed: 0, failed: 0, pending: 0 },
      executions: { total: 0, bySymbol: {} },
      errors: { total: 0, byType: {} },
    };
    this.startTime = Date.now();
  }

  /**
   * Get summary string
   */
  summary(): string {
    const metrics = this.getMetrics();
    const uptime = Math.round(metrics.uptime / 1000);

    return [
      `Uptime: ${uptime}s`,
      `Total Requests: ${metrics.totalRequests}`,
      `Total Errors: ${metrics.totalErrors} (${(metrics.errorRate * 100).toFixed(2)}%)`,
      `Orders: Placed ${metrics.orders.placed}, Completed ${metrics.orders.completed}, Failed ${metrics.orders.failed}, Pending ${metrics.orders.pending}`,
      `Executions: ${metrics.executions.total} total`,
      `Endpoints: ${metrics.endpoints.length}`,
    ].join('\n');
  }
}

/**
 * Global metrics collector instance
 */
export const metricsCollector = new MetricsCollector();

/**
 * Create a new metrics collector
 */
export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}

/**
 * Export metrics in Prometheus format (for monitoring systems)
 */
export function exportPrometheus(metrics: AggregatedMetrics): string {
  const lines: string[] = [];

  // Help text
  lines.push('# HELP api_requests_total Total number of API requests');
  lines.push('# TYPE api_requests_total counter');
  metrics.endpoints.forEach((ep) => {
    lines.push(`api_requests_total{method="${ep.method}",path="${ep.path}"} ${ep.requestCount}`);
  });

  lines.push('');
  lines.push('# HELP api_errors_total Total number of API errors');
  lines.push('# TYPE api_errors_total counter');
  metrics.endpoints.forEach((ep) => {
    lines.push(`api_errors_total{method="${ep.method}",path="${ep.path}"} ${ep.errorCount}`);
  });

  lines.push('');
  lines.push('# HELP api_request_latency_ms API request latency in milliseconds');
  lines.push('# TYPE api_request_latency_ms gauge');
  metrics.endpoints.forEach((ep) => {
    lines.push(
      `api_request_latency_ms{method="${ep.method}",path="${ep.path}",quantile="avg"} ${ep.latency.avg}`,
    );
    lines.push(
      `api_request_latency_ms{method="${ep.method}",path="${ep.path}",quantile="min"} ${ep.latency.min}`,
    );
    lines.push(
      `api_request_latency_ms{method="${ep.method}",path="${ep.path}",quantile="max"} ${ep.latency.max}`,
    );
  });

  lines.push('');
  lines.push('# HELP orders_placed_total Total number of orders placed');
  lines.push('# TYPE orders_placed_total counter');
  lines.push(`orders_placed_total ${metrics.orders.placed}`);

  lines.push('');
  lines.push('# HELP orders_completed_total Total number of orders completed');
  lines.push('# TYPE orders_completed_total counter');
  lines.push(`orders_completed_total ${metrics.orders.completed}`);

  lines.push('');
  lines.push('# HELP orders_failed_total Total number of orders failed');
  lines.push('# TYPE orders_failed_total counter');
  lines.push(`orders_failed_total ${metrics.orders.failed}`);

  lines.push('');
  lines.push('# HELP orders_pending Total number of pending orders');
  lines.push('# TYPE orders_pending gauge');
  lines.push(`orders_pending ${metrics.orders.pending}`);

  lines.push('');
  lines.push('# HELP executions_total Total number of executions');
  lines.push('# TYPE executions_total counter');
  lines.push(`executions_total ${metrics.executions.total}`);

  Object.entries(metrics.executions.bySymbol).forEach(([symbol, count]) => {
    lines.push(`executions_total{symbol="${symbol}"} ${count}`);
  });

  return lines.join('\n');
}
