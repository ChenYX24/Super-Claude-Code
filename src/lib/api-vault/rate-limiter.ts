/**
 * Rate Limiter - Tracks API usage per key per time window.
 *
 * Uses an in-memory sliding window. State resets on server restart.
 * Suitable for a local dashboard; not for distributed systems.
 */

// ---- Types ----

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitStatus {
  keyId: string;
  remaining: number;
  limit: number;
  resetAt: number;
  blocked: boolean;
}

// ---- Default limits by provider ----

export const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  anthropic: { maxRequests: 50, windowMs: 60_000 },     // 50 req/min
  openai: { maxRequests: 60, windowMs: 60_000 },         // 60 req/min
  google: { maxRequests: 60, windowMs: 60_000 },
  mistral: { maxRequests: 30, windowMs: 60_000 },
  cohere: { maxRequests: 40, windowMs: 60_000 },
  other: { maxRequests: 30, windowMs: 60_000 },
};

// ---- In-memory store ----

interface WindowEntry {
  timestamps: number[];
  config: RateLimitConfig;
}

const windows: Map<string, WindowEntry> = new Map();

// ---- API ----

/**
 * Check rate limit status for a key without consuming a request.
 */
export function checkRateLimit(keyId: string, provider: string): RateLimitStatus {
  const config = DEFAULT_LIMITS[provider] || DEFAULT_LIMITS.other;
  const entry = getOrCreateWindow(keyId, config);
  const now = Date.now();

  // Prune expired timestamps
  const cutoff = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
  const oldestInWindow = entry.timestamps[0];
  const resetAt = oldestInWindow ? oldestInWindow + config.windowMs : now + config.windowMs;

  return {
    keyId,
    remaining,
    limit: config.maxRequests,
    resetAt,
    blocked: remaining === 0,
  };
}

/**
 * Consume a rate limit token. Returns status after consumption.
 * If blocked, does NOT consume a token.
 */
export function consumeRateLimit(keyId: string, provider: string): RateLimitStatus {
  const status = checkRateLimit(keyId, provider);
  if (status.blocked) return status;

  const entry = windows.get(keyId)!;
  entry.timestamps.push(Date.now());

  return {
    ...status,
    remaining: status.remaining - 1,
    blocked: status.remaining - 1 === 0,
  };
}

/**
 * Reset rate limit for a key (e.g., after a provider limit reset).
 */
export function resetRateLimit(keyId: string): void {
  windows.delete(keyId);
}

/**
 * Get all tracked keys and their current status.
 */
export function getAllRateLimits(): RateLimitStatus[] {
  const results: RateLimitStatus[] = [];
  for (const [keyId, entry] of windows) {
    const now = Date.now();
    const cutoff = now - entry.config.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const remaining = Math.max(0, entry.config.maxRequests - entry.timestamps.length);
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow ? oldestInWindow + entry.config.windowMs : now + entry.config.windowMs;

    results.push({
      keyId,
      remaining,
      limit: entry.config.maxRequests,
      resetAt,
      blocked: remaining === 0,
    });
  }
  return results;
}

// ---- Internal ----

function getOrCreateWindow(keyId: string, config: RateLimitConfig): WindowEntry {
  let entry = windows.get(keyId);
  if (!entry) {
    entry = { timestamps: [], config };
    windows.set(keyId, entry);
  }
  return entry;
}
