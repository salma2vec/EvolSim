/**
 * Memoization utilities for expensive computations
 */

type MemoizedFunction<T extends (...args: any[]) => any> = T & {
  clear: () => void;
  cache: Map<string, ReturnType<T>>;
};

/**
 * Memoize a function with a custom key generator
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): MemoizedFunction<T> {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as MemoizedFunction<T>;

  memoized.clear = () => cache.clear();
  memoized.cache = cache;

  return memoized;
}

/**
 * Memoize with TTL (time-to-live)
 */
export function memoizeWithTTL<T extends (...args: any[]) => any>(
  fn: T,
  ttlMs: number,
  keyGenerator?: (...args: Parameters<T>) => string
): MemoizedFunction<T> {
  const cache = new Map<string, { value: ReturnType<T>; expires: number }>();

  const memoized = ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, {
      value: result,
      expires: Date.now() + ttlMs,
    });
    return result;
  }) as MemoizedFunction<T>;

  memoized.clear = () => cache.clear();
  memoized.cache = new Map();

  return memoized;
}

