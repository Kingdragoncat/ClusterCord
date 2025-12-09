import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis-backed rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false
  } = config;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(request);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs
      };
    }

    // Increment counter
    store[key].count++;

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetAt - now) / 1000);

      reply.header('Retry-After', retryAfter.toString());
      reply.header('X-RateLimit-Limit', maxRequests.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('X-RateLimit-Reset', store[key].resetAt.toString());

      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header(
      'X-RateLimit-Remaining',
      (maxRequests - store[key].count).toString()
    );
    reply.header('X-RateLimit-Reset', store[key].resetAt.toString());

    // Decrement on successful response if configured
    if (skipSuccessfulRequests) {
      reply.addHook('onResponse', (request, reply, done) => {
        if (reply.statusCode < 400 && store[key]) {
          store[key].count--;
        }
        done();
      });
    }
  };
}

/**
 * Cleanup expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 60000); // Clean up every minute

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  // General API: 100 requests per minute
  general: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100
  }),

  // Terminal commands: 30 per minute
  terminal: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30
  }),

  // Authentication: 5 attempts per minute
  auth: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    skipSuccessfulRequests: true
  }),

  // Cluster operations: 20 per minute
  cluster: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20
  }),

  // Strict limit for sensitive operations: 10 per 5 minutes
  strict: createRateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 10
  })
};
