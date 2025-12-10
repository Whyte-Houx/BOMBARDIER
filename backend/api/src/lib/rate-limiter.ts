/**
 * Advanced Per-Endpoint Rate Limiting
 * 
 * Provides granular rate limiting based on:
 * - Endpoint patterns
 * - HTTP methods
 * - User roles
 * - Custom quotas per route
 * 
 * @module lib/rate-limiter
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

// ============================================================================
// Types
// ============================================================================

export interface RateLimitRule {
    /** Max requests in the time window */
    max: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Optional: Different limits by role */
    byRole?: Record<string, { max: number; windowSeconds: number }>;
    /** Skip rate limiting for these roles */
    skipRoles?: string[];
    /** Custom key generator */
    keyGenerator?: (request: FastifyRequest) => string;
    /** Error message template */
    errorMessage?: string;
    /** Cost per request (for weighted rate limiting) */
    cost?: number;
}

export interface RateLimitConfig {
    /** Global default rate limit */
    global: {
        max: number;
        windowSeconds: number;
    };
    /** Per-endpoint rules */
    endpoints: Record<string, RateLimitRule>;
    /** Enable/disable rate limiting */
    enabled: boolean;
    /** Redis key prefix */
    keyPrefix: string;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
    cost: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultRateLimitConfig: RateLimitConfig = {
    enabled: true,
    keyPrefix: 'ratelimit',
    global: {
        max: 100,
        windowSeconds: 60
    },
    endpoints: {
        // Authentication - Strict limits to prevent brute force
        'POST /auth/login': {
            max: 5,
            windowSeconds: 60,
            byRole: {},
            errorMessage: 'Too many login attempts. Please wait before trying again.',
            cost: 1
        },
        'POST /auth/register': {
            max: 3,
            windowSeconds: 3600, // 1 hour
            errorMessage: 'Registration rate limit exceeded. Please try again later.',
            cost: 1
        },
        'POST /auth/forgot-password': {
            max: 3,
            windowSeconds: 3600,
            errorMessage: 'Password reset limit reached.',
            cost: 1
        },

        // Campaigns - Moderate limits
        'POST /v1/campaigns': {
            max: 10,
            windowSeconds: 3600,
            byRole: {
                admin: { max: 100, windowSeconds: 3600 },
                operator: { max: 50, windowSeconds: 3600 }
            },
            cost: 5 // Creating campaigns is expensive
        },
        'POST /v1/campaigns/*/start': {
            max: 5,
            windowSeconds: 60,
            skipRoles: ['admin'],
            cost: 10 // Starting campaigns is very expensive
        },

        // Profiles - Higher limits for batch operations
        'GET /v1/profiles': {
            max: 120,
            windowSeconds: 60,
            byRole: {
                admin: { max: 500, windowSeconds: 60 }
            },
            cost: 1
        },
        'POST /v1/profiles/advanced-search': {
            max: 30,
            windowSeconds: 60,
            byRole: {
                admin: { max: 100, windowSeconds: 60 }
            },
            cost: 3 // Complex queries cost more
        },
        'POST /v1/profiles/batch/*': {
            max: 10,
            windowSeconds: 60,
            cost: 5
        },

        // Webhooks - Limit creation but not queries
        'POST /v1/webhooks': {
            max: 10,
            windowSeconds: 3600,
            cost: 2
        },
        'POST /v1/webhooks/*/test': {
            max: 10,
            windowSeconds: 300, // 5 minutes
            cost: 1
        },

        // Analytics - High read, low write
        'GET /v1/analytics/*': {
            max: 60,
            windowSeconds: 60,
            cost: 1
        },
        'POST /v1/analytics/event': {
            max: 100,
            windowSeconds: 60,
            skipRoles: ['admin'],
            cost: 1
        },

        // Cloak operations - Sensitive
        'POST /v1/cloak/vpn/*': {
            max: 5,
            windowSeconds: 300,
            skipRoles: ['admin'],
            cost: 10
        },
        'POST /v1/cloak/fingerprint/generate': {
            max: 20,
            windowSeconds: 60,
            cost: 2
        },
        'POST /v1/cloak/proxy/acquire': {
            max: 30,
            windowSeconds: 60,
            cost: 1
        },

        // Messages - Rate limit sending
        'POST /v1/messages': {
            max: 100,
            windowSeconds: 60,
            byRole: {
                admin: { max: 500, windowSeconds: 60 }
            },
            cost: 2
        },

        // Pipeline - Very limited
        'POST /v1/pipeline/run': {
            max: 5,
            windowSeconds: 300,
            skipRoles: ['admin'],
            cost: 20 // Very expensive operation
        },

        // Health & Metrics - No limits for monitoring
        'GET /health/*': {
            max: 1000,
            windowSeconds: 60,
            skipRoles: ['admin', 'operator', 'viewer'],
            cost: 0
        },
        'GET /metrics': {
            max: 60,
            windowSeconds: 60,
            cost: 0
        }
    }
};

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class AdvancedRateLimiter {
    private redis: RedisClient | null = null;
    private config: RateLimitConfig;
    private localFallback: Map<string, { count: number; resetAt: number }> = new Map();

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = {
            ...defaultRateLimitConfig,
            ...config,
            endpoints: {
                ...defaultRateLimitConfig.endpoints,
                ...config.endpoints
            }
        };
    }

    /**
     * Set Redis client for distributed rate limiting
     */
    setRedis(redis: RedisClient): void {
        this.redis = redis;
    }

    /**
     * Match a request path to an endpoint rule
     */
    private matchEndpoint(method: string, path: string): RateLimitRule | null {
        const fullPath = `${method} ${path}`;

        // Exact match first
        if (this.config.endpoints[fullPath]) {
            return this.config.endpoints[fullPath];
        }

        // Pattern matching with wildcards
        for (const [pattern, rule] of Object.entries(this.config.endpoints)) {
            const regex = new RegExp(
                '^' +
                pattern
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '[^/]+') +
                '$'
            );

            if (regex.test(fullPath)) {
                return rule;
            }
        }

        return null;
    }

    /**
     * Generate rate limit key for Redis
     */
    private generateKey(request: FastifyRequest, rule: RateLimitRule): string {
        const user = (request as any).user;

        if (rule.keyGenerator) {
            return `${this.config.keyPrefix}:${rule.keyGenerator(request)}`;
        }

        // Default: by user ID or IP
        const identifier = user?.id ? `user:${user.id}` : `ip:${request.ip}`;
        const path = request.routeOptions?.url || request.url;

        return `${this.config.keyPrefix}:${request.method}:${path}:${identifier}`;
    }

    /**
     * Get effective rate limit for a user's role
     */
    private getEffectiveLimit(rule: RateLimitRule, role?: string): { max: number; windowSeconds: number } {
        if (role && rule.byRole && rule.byRole[role]) {
            return rule.byRole[role];
        }

        return {
            max: rule.max,
            windowSeconds: rule.windowSeconds
        };
    }

    /**
     * Check rate limit using Redis (distributed)
     */
    private async checkRedis(
        key: string,
        limit: number,
        windowSeconds: number,
        cost: number
    ): Promise<RateLimitResult> {
        if (!this.redis) {
            return this.checkLocal(key, limit, windowSeconds, cost);
        }

        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        const resetAt = new Date(now + windowMs);

        try {
            // Use sliding window counter with node-redis camelCase methods
            const multi = this.redis.multi();

            // Remove old entries
            multi.zRemRangeByScore(key, 0, now - windowMs);

            // Count current entries
            multi.zCard(key);

            // Add new entry with score = timestamp
            multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

            // Set expiry
            multi.expire(key, windowSeconds + 1);

            const results = await multi.exec();

            if (!results) {
                return this.checkLocal(key, limit, windowSeconds, cost);
            }

            // node-redis returns results directly, not as [error, result] tuples
            const currentCount = (results[1] as number) || 0;
            const newCount = currentCount + cost;
            const remaining = Math.max(0, limit - newCount);
            const allowed = newCount <= limit;

            return {
                allowed,
                remaining,
                resetAt,
                limit,
                cost
            };
        } catch (err) {
            console.error('[rate-limiter] Redis error, falling back to local:', err);
            return this.checkLocal(key, limit, windowSeconds, cost);
        }
    }

    /**
     * Check rate limit using local memory (fallback)
     */
    private checkLocal(
        key: string,
        limit: number,
        windowSeconds: number,
        cost: number
    ): RateLimitResult {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        let entry = this.localFallback.get(key);

        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + windowMs };
        }

        entry.count += cost;
        this.localFallback.set(key, entry);

        const remaining = Math.max(0, limit - entry.count);
        const allowed = entry.count <= limit;

        // Cleanup old entries periodically
        if (Math.random() < 0.01) {
            for (const [k, v] of this.localFallback) {
                if (v.resetAt < now) {
                    this.localFallback.delete(k);
                }
            }
        }

        return {
            allowed,
            remaining,
            resetAt: new Date(entry.resetAt),
            limit,
            cost
        };
    }

    /**
     * Main rate limit check
     */
    async check(request: FastifyRequest): Promise<RateLimitResult> {
        if (!this.config.enabled) {
            return { allowed: true, remaining: Infinity, resetAt: new Date(), limit: Infinity, cost: 0 };
        }

        const user = (request as any).user;
        const role = user?.role;

        // Find matching rule
        const rule = this.matchEndpoint(request.method, request.url);

        // Check if role is exempt
        if (rule?.skipRoles?.includes(role)) {
            return { allowed: true, remaining: Infinity, resetAt: new Date(), limit: Infinity, cost: 0 };
        }

        // Use rule or global default
        const effectiveRule = rule || {
            max: this.config.global.max,
            windowSeconds: this.config.global.windowSeconds,
            cost: 1
        };

        const limits = this.getEffectiveLimit(effectiveRule, role);
        const key = this.generateKey(request, effectiveRule);
        const cost = effectiveRule.cost || 1;

        return this.checkRedis(key, limits.max, limits.windowSeconds, cost);
    }

    /**
     * Get error message for rate limit exceeded
     */
    getErrorMessage(request: FastifyRequest, result: RateLimitResult): string {
        const rule = this.matchEndpoint(request.method, request.url);

        if (rule?.errorMessage) {
            return rule.errorMessage;
        }

        const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
        return `Rate limit exceeded. Please retry after ${retryAfter} seconds.`;
    }
}

// ============================================================================
// Fastify Plugin
// ============================================================================

export async function rateLimitPlugin(
    app: FastifyInstance,
    options: { redis?: RedisClient; config?: Partial<RateLimitConfig> } = {}
): Promise<void> {
    const limiter = new AdvancedRateLimiter(options.config);

    if (options.redis) {
        limiter.setRedis(options.redis);
    }

    // Decorate the app with the rate limiter
    app.decorate('rateLimiter', limiter);

    // Add hook to check rate limits
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await limiter.check(request);

        // Set rate limit headers
        reply.header('X-RateLimit-Limit', result.limit.toString());
        reply.header('X-RateLimit-Remaining', result.remaining.toString());
        reply.header('X-RateLimit-Reset', result.resetAt.toISOString());
        reply.header('X-RateLimit-Cost', result.cost.toString());

        if (!result.allowed) {
            const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
            reply.header('Retry-After', retryAfter.toString());

            return reply.code(429).send({
                error: 'RATE_LIMIT_EXCEEDED',
                message: limiter.getErrorMessage(request, result),
                retryAfter,
                limit: result.limit,
                remaining: 0,
                resetAt: result.resetAt.toISOString()
            });
        }
    });
}

// ============================================================================
// Export Singleton
// ============================================================================

export const rateLimiter = new AdvancedRateLimiter();
