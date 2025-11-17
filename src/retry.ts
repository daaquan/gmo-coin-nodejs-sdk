/**
 * Retry strategy for API requests with exponential backoff
 * Implements jitter to avoid thundering herd
 */

export interface RetryOptions {
  maxRetries?: number;           // Default: 3
  initialDelay?: number;         // Default: 100ms
  maxDelay?: number;             // Default: 10000ms
  backoffMultiplier?: number;    // Default: 2
  jitterFactor?: number;         // Default: 0.1 (10%)
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryState {
  attempt: number;
  lastError: Error;
  nextRetryIn: number;
}

/**
 * Determine if an error is retryable
 * @param error The error to check
 * @returns true if the error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  // Network errors (retryable)
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound')) {
    return true;
  }

  // Rate limit (ERR-5003) - retryable with backoff
  if (msg.includes('err-5003') || msg.includes('rate limit')) {
    return true;
  }

  // Server errors (5xx) - retryable
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return true;
  }

  // Temporary issues
  if (msg.includes('temporarily unavailable')) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 * Formula: delay = min(initialDelay * (backoffMultiplier ^ attempt), maxDelay) * (1 + jitter)
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitterFactor: number
): number {
  const exponentialDelay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, attempt),
    maxDelay
  );

  // Add jitter: ±jitterFactor * exponentialDelay
  const jitter = (Math.random() - 0.5) * 2 * jitterFactor * exponentialDelay;
  return Math.max(1, exponentialDelay + jitter);
}

/**
 * Sleep for given milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter
 * @param fn The async function to retry
 * @param options Retry options
 * @returns The result of the function on success
 * @throws Error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(() => client.placeOrder(body), {
 *   maxRetries: 3,
 *   initialDelay: 100,
 *   shouldRetry: (error) => error.message.includes('ERR-5003')
 * });
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10_000,
    backoffMultiplier = 2,
    jitterFactor = 0.1,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const canRetry = shouldRetry(lastError, attempt);
      if (!canRetry || attempt >= maxRetries) {
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier, jitterFactor);
      await sleep(delay);
      attempt++;
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Retry failed');
}

/**
 * Retry a function with circuit breaker pattern
 * Opens circuit after consecutive failures, preventing cascading failures
 */
export class CircuitBreaker<T> {
  private failureCount = 0;
  private successCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttemptTime = 0;

  constructor(
    private fn: () => Promise<T>,
    private options = {
      failureThreshold: 5,        // Open circuit after 5 failures
      successThreshold: 2,        // Close circuit after 2 successes
      timeout: 60_000,            // Try to recover after 60s
    }
  ) {}

  async execute(): Promise<T> {
    const now = Date.now();

    // If circuit is open, check if we should try to recover
    if (this.state === 'OPEN') {
      if (now < this.nextAttemptTime) {
        throw new Error(`CircuitBreaker is OPEN. Retry after ${this.nextAttemptTime - now}ms`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.fn();

      // Success
      this.failureCount = 0;
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.options.successThreshold) {
          this.state = 'CLOSED';
          this.successCount = 0;
        }
      }

      return result;
    } catch (error) {
      // Failure
      this.successCount = 0;
      this.failureCount++;

      if (this.failureCount >= this.options.failureThreshold) {
        this.state = 'OPEN';
        this.nextAttemptTime = now + this.options.timeout;
      }

      throw error;
    }
  }

  getState(): { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
    };
  }
}

/**
 * Combine retry and circuit breaker
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker(() => client.placeOrder(body));
 * const result = await retryWithBackoff(() => breaker.execute(), {
 *   maxRetries: 3
 * });
 * ```
 */
export async function retryWithCircuitBreaker<T>(
  breaker: CircuitBreaker<T>,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(() => breaker.execute(), retryOptions);
}
