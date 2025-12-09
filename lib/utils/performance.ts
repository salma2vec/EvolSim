/**
 * Performance monitoring utilities
 */

export interface PerformanceMetrics {
  duration: number;
  timestamp: number;
  label: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000;

  start(label: string): () => void {
    const startTime = performance.now();
    const timestamp = Date.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record({ duration, timestamp, label });

      if (this.metrics.length > this.maxMetrics) {
        this.metrics.shift();
      }
    };
  }

  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageDuration(label: string): number {
    const relevant = this.metrics.filter(m => m.label === label);
    if (relevant.length === 0) return 0;
    return relevant.reduce((sum, m) => sum + m.duration, 0) / relevant.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const end = performanceMonitor.start(label);
  try {
    const result = await fn();
    return result;
  } finally {
    end();
  }
}

/**
 * Measure sync function execution time
 */
export function measureSync<T>(
  label: string,
  fn: () => T
): T {
  const end = performanceMonitor.start(label);
  try {
    return fn();
  } finally {
    end();
  }
}

