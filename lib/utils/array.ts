/**
 * Array utility functions
 */

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get last N elements from array
 */
export function last<T>(array: T[], n: number): T[] {
  return array.slice(-n);
}

/**
 * Get first N elements from array
 */
export function first<T>(array: T[], n: number): T[] {
  return array.slice(0, n);
}

/**
 * Group array by key function
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Sum array of numbers
 */
export function sum(array: number[]): number {
  return array.reduce((a, b) => a + b, 0);
}

/**
 * Average of array of numbers
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0;
  return sum(array) / array.length;
}

