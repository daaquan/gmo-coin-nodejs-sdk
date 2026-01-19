/**
 * Simple in-memory cache with TTL (Time To Live) support
 * Useful for caching API responses with automatic expiration
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  /**
   * Time to live in milliseconds
   * Default: 1000ms (1 second)
   */
  ttl?: number;

  /**
   * Maximum number of entries to store
   * Default: 1000
   */
  maxSize?: number;
}

/**
 * Simple TTL-based in-memory cache
 * Automatically removes expired entries on access
 * Implements LRU (Least Recently Used) eviction when max size is reached
 */
export class TtlCache<T = unknown> {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];
  private defaultTtl: number;
  private maxSize: number;

  constructor(options?: CacheOptions) {
    this.defaultTtl = options?.ttl ?? 1000; // Default 1 second
    this.maxSize = options?.maxSize ?? 1000;
  }

  /**
   * Get a value from cache
   * Returns undefined if key doesn't exist or has expired
   */
  get<U = T>(key: string): U | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return undefined;
    }

    // Update access order (mark as recently used)
    this.updateAccessOrder(key);

    return entry.value as U;
  }

  /**
   * Set a value in cache with optional TTL
   */
  set(key: string, value: unknown, ttl?: number): void {
    const ttlMs = ttl ?? this.defaultTtl;

    // If key already exists, remove it from access order
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Add new entry
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    // Update access order
    this.accessOrder.push(key);

    // Evict oldest entry if max size exceeded
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() >= (entry as CacheEntry<unknown>).expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * Clear a specific key
   */
  delete(key: string): boolean {
    this.removeFromAccessOrder(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired entries
   * Useful to call periodically to free memory
   */
  cleanup(): number {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() >= (entry as CacheEntry<unknown>).expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
}

/**
 * Create a cache key from function arguments
 * Useful for caching function results
 */
export function createCacheKey(namespace: string, args: unknown[]): string {
  const argsStr = args
    .map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    })
    .join(':');

  return `${namespace}:${argsStr}`;
}

/**
 * Decorator for caching function results with TTL
 * @param cache TtlCache instance
 * @param namespace Cache key namespace
 * @param ttl Time to live in milliseconds
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  cache: TtlCache,
  namespace: string,
  ttl?: number,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = createCacheKey(namespace, args);
      const cached = cache.get(cacheKey);

      if (cached !== undefined) {
        return cached as T;
      }

      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}
