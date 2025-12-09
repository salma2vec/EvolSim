/**
 * Rate limiting utilities
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private config: RateLimitConfig) {}

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const requests = this.requests.get(identifier) || [];
    const recentRequests = requests.filter(time => time > windowStart);

    const allowed = recentRequests.length < this.config.maxRequests;

    if (allowed) {
      recentRequests.push(now);
      this.requests.set(identifier, recentRequests);
    }

    const resetAt = recentRequests.length > 0
      ? recentRequests[0] + this.config.windowMs
      : now + this.config.windowMs;

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - recentRequests.length),
      resetAt,
    };
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.requests.delete(identifier);
    } else {
      this.requests.clear();
    }
  }
}

export const apiRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000, // 1 minute
});

export const simulationRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});

