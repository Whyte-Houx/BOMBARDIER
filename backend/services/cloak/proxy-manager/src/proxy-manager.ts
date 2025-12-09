/**
 * Proxy Manager - Core Implementation
 * Sophisticated proxy rotation with health monitoring and session persistence
 */

import { Redis } from 'ioredis';
import pino from 'pino';
import {
    ProxyConfig,
    ProxyPool,
    ProxyType,
    Geography,
    ProxyStatus,
    ProxyAcquisitionOptions,
    ProxyHealthReport,
    ProxyUsageStats,
} from './types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class ProxyManager {
    private pools: Map<string, ProxyPool> = new Map();
    private sessionProxyMap: Map<string, string> = new Map(); // sessionId -> proxyId
    private redis: Redis;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
    }

    /**
     * Initialize proxy pools from configuration
     */
    async initialize(config: { pools: ProxyPool[] }): Promise<void> {
        logger.info('Initializing proxy manager...');

        for (const pool of config.pools) {
            const key = `${pool.type}-${pool.geography}`;
            this.pools.set(key, pool);

            // Load proxy health data from Redis
            await this.loadProxyHealth(pool);
        }

        // Start health monitoring
        this.startHealthMonitoring();

        logger.info({ poolCount: this.pools.size }, 'Proxy manager initialized');
    }

    /**
     * Acquire a proxy based on criteria
     */
    async acquireProxy(options: ProxyAcquisitionOptions = {}): Promise<ProxyConfig> {
        // Check for session persistence
        if (options.sessionId) {
            const existingProxyId = this.sessionProxyMap.get(options.sessionId);
            if (existingProxyId) {
                const proxy = this.findProxyById(existingProxyId);
                if (proxy && proxy.status === 'active') {
                    logger.debug({ sessionId: options.sessionId, proxyId: existingProxyId }, 'Reusing session proxy');
                    return proxy;
                }
            }
        }

        // Find suitable pool
        const pool = this.selectPool(options);
        if (!pool) {
            throw new Error('No suitable proxy pool found');
        }

        // Select best proxy from pool
        const proxy = this.selectProxyFromPool(pool, options);
        if (!proxy) {
            throw new Error('No available proxies in pool');
        }

        // Bind to session if provided
        if (options.sessionId) {
            this.sessionProxyMap.set(options.sessionId, proxy.id);
            await this.redis.set(
                `proxy:session:${options.sessionId}`,
                proxy.id,
                'EX',
                86400 * 7 // 7 days
            );
        }

        logger.info(
            {
                proxyId: proxy.id,
                type: proxy.type,
                geography: proxy.geography,
                sessionId: options.sessionId,
            },
            'Proxy acquired'
        );

        return proxy;
    }

    /**
     * Release a proxy (mark as available)
     */
    async releaseProxy(proxyId: string, sessionId?: string): Promise<void> {
        if (sessionId) {
            this.sessionProxyMap.delete(sessionId);
            await this.redis.del(`proxy:session:${sessionId}`);
        }

        logger.debug({ proxyId, sessionId }, 'Proxy released');
    }

    /**
     * Report proxy usage and update health metrics
     */
    async reportUsage(proxyId: string, stats: Partial<ProxyUsageStats>): Promise<void> {
        const proxy = this.findProxyById(proxyId);
        if (!proxy) {
            logger.warn({ proxyId }, 'Proxy not found for usage report');
            return;
        }

        // Update metadata
        proxy.metadata.totalRequests += stats.requestCount || 0;
        proxy.metadata.failedRequests += stats.failureCount || 0;
        proxy.metadata.lastUsed = new Date();

        // Update success rate
        const totalRequests = proxy.metadata.totalRequests;
        const successfulRequests = totalRequests - proxy.metadata.failedRequests;
        proxy.metadata.successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;

        // Update CAPTCHA rate
        if (stats.captchaCount) {
            const captchaRate = stats.captchaCount / (stats.requestCount || 1);
            proxy.metadata.captchaRate =
                proxy.metadata.captchaRate * 0.8 + captchaRate * 0.2; // Exponential moving average
        }

        // Update response time
        if (stats.avgResponseTime) {
            proxy.metadata.avgResponseTime =
                proxy.metadata.avgResponseTime * 0.8 + stats.avgResponseTime * 0.2;
        }

        // Determine status based on metrics
        this.updateProxyStatus(proxy);

        // Persist to Redis
        await this.persistProxyHealth(proxy);

        logger.debug(
            {
                proxyId,
                successRate: proxy.metadata.successRate,
                captchaRate: proxy.metadata.captchaRate,
                status: proxy.status,
            },
            'Proxy usage reported'
        );
    }

    /**
     * Mark proxy as blocked
     */
    async markBlocked(proxyId: string, cooldownMinutes: number = 60): Promise<void> {
        const proxy = this.findProxyById(proxyId);
        if (!proxy) return;

        proxy.status = 'blocked';
        proxy.metadata.blockedAt = new Date();
        proxy.metadata.cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

        await this.persistProxyHealth(proxy);

        logger.warn(
            {
                proxyId,
                cooldownMinutes,
                cooldownUntil: proxy.metadata.cooldownUntil,
            },
            'Proxy marked as blocked'
        );
    }

    /**
     * Get health report for all proxies
     */
    async getHealthReport(): Promise<ProxyHealthReport> {
        const report: ProxyHealthReport = {
            totalProxies: 0,
            activeProxies: 0,
            degradedProxies: 0,
            blockedProxies: 0,
            avgSuccessRate: 0,
            avgCaptchaRate: 0,
            poolHealth: {},
        };

        let totalSuccessRate = 0;
        let totalCaptchaRate = 0;

        for (const [key, pool] of this.pools) {
            const poolStats = {
                type: pool.type,
                geography: pool.geography,
                count: pool.proxies.length,
                avgSuccessRate: 0,
            };

            let poolSuccessRate = 0;

            for (const proxy of pool.proxies) {
                report.totalProxies++;
                totalSuccessRate += proxy.metadata.successRate;
                totalCaptchaRate += proxy.metadata.captchaRate;
                poolSuccessRate += proxy.metadata.successRate;

                switch (proxy.status) {
                    case 'active':
                        report.activeProxies++;
                        break;
                    case 'degraded':
                        report.degradedProxies++;
                        break;
                    case 'blocked':
                    case 'cooldown':
                        report.blockedProxies++;
                        break;
                }
            }

            poolStats.avgSuccessRate = pool.proxies.length > 0 ? poolSuccessRate / pool.proxies.length : 0;
            report.poolHealth[key] = poolStats;
        }

        report.avgSuccessRate = report.totalProxies > 0 ? totalSuccessRate / report.totalProxies : 0;
        report.avgCaptchaRate = report.totalProxies > 0 ? totalCaptchaRate / report.totalProxies : 0;

        return report;
    }

    /**
     * Rotate proxy if needed based on health
     */
    async rotateIfNeeded(proxyId: string): Promise<ProxyConfig | null> {
        const proxy = this.findProxyById(proxyId);
        if (!proxy) return null;

        // Check if rotation is needed
        const needsRotation =
            proxy.status === 'blocked' ||
            proxy.status === 'cooldown' ||
            proxy.metadata.successRate < 0.7 ||
            proxy.metadata.captchaRate > 0.3;

        if (!needsRotation) {
            return null;
        }

        logger.info(
            {
                proxyId,
                status: proxy.status,
                successRate: proxy.metadata.successRate,
                captchaRate: proxy.metadata.captchaRate,
            },
            'Rotating proxy due to poor health'
        );

        // Find replacement from same pool
        const pool = this.findPoolForProxy(proxy);
        if (!pool) return null;

        const replacement = this.selectProxyFromPool(pool, {
            excludeIds: [proxyId],
            minSuccessRate: 0.8,
            maxCaptchaRate: 0.2,
        });

        return replacement;
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private selectPool(options: ProxyAcquisitionOptions): ProxyPool | null {
        const type = options.type || 'residential';
        const geography = options.geography || 'GLOBAL';

        // Try exact match first
        let key = `${type}-${geography}`;
        let pool = this.pools.get(key);

        if (!pool && geography !== 'GLOBAL') {
            // Fallback to GLOBAL
            key = `${type}-GLOBAL`;
            pool = this.pools.get(key);
        }

        return pool || null;
    }

    private selectProxyFromPool(pool: ProxyPool, options: ProxyAcquisitionOptions): ProxyConfig | null {
        const minSuccessRate = options.minSuccessRate || 0.7;
        const maxCaptchaRate = options.maxCaptchaRate || 0.3;
        const excludeIds = new Set(options.excludeIds || []);

        // Filter available proxies
        const available = pool.proxies.filter(
            (p) =>
                !excludeIds.has(p.id) &&
                (p.status === 'active' || p.status === 'degraded') &&
                p.metadata.successRate >= minSuccessRate &&
                p.metadata.captchaRate <= maxCaptchaRate &&
                (!p.metadata.cooldownUntil || p.metadata.cooldownUntil < new Date())
        );

        if (available.length === 0) {
            return null;
        }

        // Select based on strategy
        switch (pool.rotationStrategy) {
            case 'round-robin':
                return available[0]; // Simple rotation
            case 'least-used':
                return available.sort((a, b) => a.metadata.totalRequests - b.metadata.totalRequests)[0];
            case 'performance-based':
            default:
                // Score based on success rate and response time
                return available.sort((a, b) => {
                    const scoreA = a.metadata.successRate * (1 - a.metadata.captchaRate) / (a.metadata.avgResponseTime || 1000);
                    const scoreB = b.metadata.successRate * (1 - b.metadata.captchaRate) / (b.metadata.avgResponseTime || 1000);
                    return scoreB - scoreA;
                })[0];
        }
    }

    private findProxyById(proxyId: string): ProxyConfig | null {
        for (const pool of this.pools.values()) {
            const proxy = pool.proxies.find((p) => p.id === proxyId);
            if (proxy) return proxy;
        }
        return null;
    }

    private findPoolForProxy(proxy: ProxyConfig): ProxyPool | null {
        const key = `${proxy.type}-${proxy.geography}`;
        return this.pools.get(key) || null;
    }

    private updateProxyStatus(proxy: ProxyConfig): void {
        // Check cooldown
        if (proxy.metadata.cooldownUntil && proxy.metadata.cooldownUntil > new Date()) {
            proxy.status = 'cooldown';
            return;
        }

        // Check if blocked
        if (proxy.metadata.successRate < 0.3 || proxy.metadata.captchaRate > 0.5) {
            proxy.status = 'blocked';
            return;
        }

        // Check if degraded
        if (proxy.metadata.successRate < 0.7 || proxy.metadata.captchaRate > 0.3) {
            proxy.status = 'degraded';
            return;
        }

        // Otherwise active
        proxy.status = 'active';
    }

    private async loadProxyHealth(pool: ProxyPool): Promise<void> {
        for (const proxy of pool.proxies) {
            const key = `proxy:health:${proxy.id}`;
            const data = await this.redis.get(key);

            if (data) {
                try {
                    const health = JSON.parse(data);
                    proxy.metadata = { ...proxy.metadata, ...health };
                } catch (err) {
                    logger.warn({ proxyId: proxy.id }, 'Failed to parse proxy health data');
                }
            }
        }
    }

    private async persistProxyHealth(proxy: ProxyConfig): Promise<void> {
        const key = `proxy:health:${proxy.id}`;
        await this.redis.set(key, JSON.stringify(proxy.metadata), 'EX', 86400 * 30); // 30 days
    }

    private startHealthMonitoring(): void {
        // Check proxy health every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                for (const pool of this.pools.values()) {
                    for (const proxy of pool.proxies) {
                        // Reset cooldown if expired
                        if (
                            proxy.status === 'cooldown' &&
                            proxy.metadata.cooldownUntil &&
                            proxy.metadata.cooldownUntil < new Date()
                        ) {
                            proxy.status = 'active';
                            logger.info({ proxyId: proxy.id }, 'Proxy cooldown expired, marked as active');
                        }

                        // Update status based on current metrics
                        this.updateProxyStatus(proxy);
                    }
                }
            } catch (err) {
                logger.error({ err }, 'Health check failed');
            }
        }, 5 * 60 * 1000);
    }

    async cleanup(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        await this.redis.quit();
    }
}
