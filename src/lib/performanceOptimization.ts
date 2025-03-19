/**
 * Performance optimization utilities for high-scale applications
 * Designed to support 200,000+ users efficiently
 */

// Cache for expensive operations
const cache = new Map<string, { value: any; expiry: number }>();

// LRU cache implementation for memory efficiency
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private keyOrder: K[];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map<K, V>();
    this.keyOrder = [];
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move key to the end (most recently used)
    this.keyOrder = this.keyOrder.filter((k) => k !== key);
    this.keyOrder.push(key);

    return this.cache.get(key);
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key
      this.cache.set(key, value);
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
      this.keyOrder.push(key);
      return;
    }

    // Check if we need to evict
    if (this.keyOrder.length >= this.capacity) {
      const oldestKey = this.keyOrder.shift();
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add new key
    this.cache.set(key, value);
    this.keyOrder.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.keyOrder = [];
  }

  size(): number {
    return this.cache.size;
  }
}

// Create component-level LRU caches
const componentDataCache = new LRUCache<string, any>(100);
const routeDataCache = new LRUCache<string, any>(50);

// Memoize expensive function calls
export function memoize<T>(
  fn: (...args: any[]) => T,
  ttl = 60000,
): (...args: any[]) => T {
  return (...args: any[]): T => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, expiry: now + ttl });

    return result;
  };
}

// Cache component data
export function cacheComponentData(
  componentId: string,
  data: any,
  ttl = 60000,
): void {
  componentDataCache.put(componentId, {
    data,
    expiry: Date.now() + ttl,
  });
}

// Get cached component data
export function getCachedComponentData(componentId: string): any | null {
  const cached = componentDataCache.get(componentId);
  if (!cached || cached.expiry < Date.now()) {
    return null;
  }
  return cached.data;
}

// Cache route data
export function cacheRouteData(route: string, data: any, ttl = 30000): void {
  routeDataCache.put(route, {
    data,
    expiry: Date.now() + ttl,
  });
}

// Get cached route data
export function getCachedRouteData(route: string): any | null {
  const cached = routeDataCache.get(route);
  if (!cached || cached.expiry < Date.now()) {
    return null;
  }
  return cached.data;
}

// Clear all caches
export function clearAllCaches(): void {
  cache.clear();
  componentDataCache.clear();
  routeDataCache.clear();
}

// Debounce function for UI operations
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for frequent events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Batch API requests
export async function batchRequests<T>(
  requests: (() => Promise<T>)[],
  batchSize = 5,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((req) => req()));
    results.push(...batchResults);
  }

  return results;
}

// Detect slow operations and log them
export function measurePerformance<T>(fn: () => T, operationName: string): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  // Log slow operations (> 100ms)
  if (duration > 100) {
    console.warn(
      `Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`,
    );
    // In production, you would send this to your monitoring system
  }

  return result;
}

// Initialize performance monitoring
export function initPerformanceMonitoring(): void {
  // Clear expired cache entries periodically
  setInterval(() => {
    const now = Date.now();
    cache.forEach((value, key) => {
      if (value.expiry < now) {
        cache.delete(key);
      }
    });
  }, 60000); // Every minute

  // Report performance metrics
  if ("performance" in window && "memory" in performance) {
    setInterval(() => {
      // @ts-ignore - memory is not in the standard PerformanceAPI type
      const memory = performance.memory;
      console.log("Memory usage:", {
        // @ts-ignore - these properties exist in Chrome
        totalJSHeapSize: memory?.totalJSHeapSize / (1024 * 1024) + " MB",
        // @ts-ignore
        usedJSHeapSize: memory?.usedJSHeapSize / (1024 * 1024) + " MB",
        // @ts-ignore
        jsHeapSizeLimit: memory?.jsHeapSizeLimit / (1024 * 1024) + " MB",
      });
    }, 30000); // Every 30 seconds
  }
}
