/**
 * Rate Limiter Utility
 * Tracks requests per user with sliding window
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, Array<number>>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.requests = new Map();
    this.config = config;
  }

  check(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get user's request timestamps
    const userRequests = this.requests.get(userId) || [];

    // Filter out expired timestamps
    const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Record this request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return {
      allowed: true,
      remaining: this.config.maxRequests - recentRequests.length,
    };
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter((timestamp) => timestamp > windowStart);

      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, recentRequests);
      }
    }
  }
}

// Export singleton instance for AI generation
export const aiGenerationRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// Periodic cleanup (run every 10 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      aiGenerationRateLimiter.cleanup();
    },
    10 * 60 * 1000
  );
}
