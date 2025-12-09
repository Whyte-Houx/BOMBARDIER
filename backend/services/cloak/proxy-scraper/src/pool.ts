/**
 * Free Proxy Pool Manager
 * Manages scraped and validated free proxies with intelligent rotation
 */

import { Redis } from 'ioredis';
import pino from 'pino';
import { ProxyScraper } from './scraper.js';
import { ProxyValidator } from './validator.js';
import type { ScrapedProxy, ValidatedProxy, ProxyProtocol } from './types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface FreeProxyPoolConfig {
    redisUrl: string;
    scrapeIntervalMinutes: number;
    validateConcurrency: number;
    minWorkingProxies: number;
    validationTimeoutMs: number;
    maxProxyAge: number; // hours
}

const DEFAULT_CONFIG: FreeProxyPoolConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    scrapeIntervalMinutes: 30,
    validateConcurrency: 50,
    minWorkingProxies: 100,
    validationTimeoutMs: 10000,
    maxProxyAge: 24,
};

export class FreeProxyPool {
    private config: FreeProxyPoolConfig;
    private redis: Redis;
    private scraper: ProxyScraper;
    private validator: ProxyValidator;
    private scrapeInterval?: NodeJS.Timeout;
    private sessionProxyMap: Map<string, string> = new Map();
    private lastScrape?: Date;
    private isRunning = false;

    constructor(config: Partial<FreeProxyPoolConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.redis = new Redis(this.config.redisUrl);
        this.scraper = new ProxyScraper();
        this.validator = new ProxyValidator({
            timeout: this.config.validationTimeoutMs,
            concurrency: this.config.validateConcurrency,
        });
    }

    /**
     * Initialize the proxy pool
     */
    async initialize(): Promise<void> {
        logger.info('Initializing free proxy pool...');

        // Load existing proxies from Redis
        await this.loadFromRedis();

        const workingCount = this.validator.getWorkingProxies().length;
        logger.info({ workingProxies: workingCount }, 'Loaded proxies from Redis');

        // If not enough proxies, scrape immediately
        if (workingCount < this.config.minWorkingProxies) {
            await this.scrapeAndValidate();
        }

        // Start periodic scraping
        this.startPeriodicScraping();

        this.isRunning = true;
        logger.info('Free proxy pool initialized');
    }

    /**
     * Acquire a proxy
     */
    async acquireProxy(options: {
        sessionId?: string;
        protocol?: ProxyProtocol;
        preferFast?: boolean;
    } = {}): Promise<ValidatedProxy | null> {
        // Check for session persistence
        if (options.sessionId) {
            const existingKey = this.sessionProxyMap.get(options.sessionId);
            if (existingKey) {
                const existing = this.validator.getWorkingProxies().find(
                    (p) => `${p.host}:${p.port}` === existingKey
                );
                if (existing && existing.isWorking) {
                    logger.debug(
                        { sessionId: options.sessionId, proxy: existingKey },
                        'Reusing session proxy'
                    );
                    return existing;
                }
            }
        }

        // Get proxies by protocol if specified
        let candidates: ValidatedProxy[];
        if (options.protocol) {
            candidates = this.validator.getProxiesByProtocol(options.protocol);
        } else if (options.preferFast) {
            candidates = this.validator.getProxiesBySpeed();
        } else {
            candidates = this.validator.getWorkingProxies();
        }

        if (candidates.length === 0) {
            logger.warn('No working proxies available');

            // Trigger emergency scrape
            this.scrapeAndValidate().catch((err) =>
                logger.error({ err }, 'Emergency scrape failed')
            );

            return null;
        }

        // Select proxy (weighted random favoring faster proxies)
        const proxy = this.selectWeightedRandom(candidates);

        // Bind to session if specified
        if (options.sessionId && proxy) {
            const key = `${proxy.host}:${proxy.port}`;
            this.sessionProxyMap.set(options.sessionId, key);

            // Store in Redis for persistence
            await this.redis.set(
                `freeproxy:session:${options.sessionId}`,
                key,
                'EX',
                86400 // 24 hours
            );
        }

        logger.debug(
            {
                host: proxy?.host,
                port: proxy?.port,
                protocol: proxy?.protocol,
                responseTime: proxy?.responseTime,
            },
            'Proxy acquired'
        );

        return proxy;
    }

    /**
     * Release a proxy (unbind from session)
     */
    async releaseProxy(sessionId: string): Promise<void> {
        this.sessionProxyMap.delete(sessionId);
        await this.redis.del(`freeproxy:session:${sessionId}`);
    }

    /**
     * Report proxy usage result
     */
    async reportUsage(
        host: string,
        port: number,
        success: boolean,
        responseTime?: number
    ): Promise<void> {
        if (success && responseTime) {
            this.validator.markSuccess(host, port, responseTime);
        } else {
            this.validator.markFailed(host, port);
        }

        // Persist to Redis
        await this.persistToRedis();
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        totalScraped: number;
        working: number;
        avgResponseTime: number;
        byProtocol: Record<ProxyProtocol, number>;
        lastScrape?: Date;
        isRunning: boolean;
    } {
        const validatorStats = this.validator.getStats();

        return {
            totalScraped: this.scraper.getCount(),
            working: validatorStats.working,
            avgResponseTime: validatorStats.avgResponseTime,
            byProtocol: validatorStats.byProtocol,
            lastScrape: this.lastScrape,
            isRunning: this.isRunning,
        };
    }

    /**
     * Get all working proxies
     */
    getWorkingProxies(): ValidatedProxy[] {
        return this.validator.getWorkingProxies();
    }

    /**
     * Force immediate scrape and validation
     */
    async forceRefresh(): Promise<void> {
        await this.scrapeAndValidate();
    }

    /**
     * Scrape and validate proxies
     */
    private async scrapeAndValidate(): Promise<void> {
        logger.info('Starting proxy scrape and validation...');

        try {
            // Scrape from all sources
            const scraped = await this.scraper.scrapeAll();
            logger.info({ count: scraped.length }, 'Scraping complete');

            // Validate all scraped proxies
            const validated = await this.validator.validateAll(scraped);
            const working = validated.filter((p) => p.isWorking).length;

            logger.info(
                {
                    scraped: scraped.length,
                    validated: validated.length,
                    working,
                },
                'Validation complete'
            );

            // Persist to Redis
            await this.persistToRedis();

            this.lastScrape = new Date();
        } catch (err) {
            logger.error({ err }, 'Failed to scrape and validate');
        }
    }

    /**
     * Start periodic scraping
     */
    private startPeriodicScraping(): void {
        const intervalMs = this.config.scrapeIntervalMinutes * 60 * 1000;

        this.scrapeInterval = setInterval(async () => {
            const workingCount = this.validator.getWorkingProxies().length;

            // Only scrape if below minimum threshold
            if (workingCount < this.config.minWorkingProxies) {
                await this.scrapeAndValidate();
            } else {
                logger.debug(
                    { workingCount },
                    'Sufficient proxies available, skipping scrape'
                );
            }
        }, intervalMs);
    }

    /**
     * Load proxies from Redis
     */
    private async loadFromRedis(): Promise<void> {
        try {
            const data = await this.redis.get('freeproxy:pool');

            if (data) {
                const proxies: ValidatedProxy[] = JSON.parse(data);

                // Filter out old proxies
                const maxAge = this.config.maxProxyAge * 60 * 60 * 1000;
                const now = Date.now();

                const fresh = proxies.filter((p) => {
                    const age = now - new Date(p.lastChecked).getTime();
                    return age < maxAge && p.isWorking;
                });

                // Re-validate loaded proxies
                const revalidated = await this.validator.validateAll(fresh);

                logger.debug(
                    {
                        loaded: proxies.length,
                        fresh: fresh.length,
                        revalidated: revalidated.filter((p) => p.isWorking).length,
                    },
                    'Loaded proxies from Redis'
                );
            }
        } catch (err) {
            logger.error({ err }, 'Failed to load proxies from Redis');
        }
    }

    /**
     * Persist proxies to Redis
     */
    private async persistToRedis(): Promise<void> {
        try {
            const proxies = this.validator.getWorkingProxies();
            await this.redis.set(
                'freeproxy:pool',
                JSON.stringify(proxies),
                'EX',
                86400 // 24 hours
            );

            logger.debug({ count: proxies.length }, 'Persisted proxies to Redis');
        } catch (err) {
            logger.error({ err }, 'Failed to persist proxies to Redis');
        }
    }

    /**
     * Select weighted random proxy (faster = higher weight)
     */
    private selectWeightedRandom(proxies: ValidatedProxy[]): ValidatedProxy | null {
        if (proxies.length === 0) return null;

        // Calculate weights (inverse of response time)
        const maxResponseTime = Math.max(...proxies.map((p) => p.responseTime));
        const weights = proxies.map((p) => {
            // Normalize: lower response time = higher weight
            const normalizedSpeed = (maxResponseTime - p.responseTime) / maxResponseTime;
            // Add base weight so slow proxies still have a chance
            return 0.1 + normalizedSpeed * 0.9;
        });

        // Calculate total weight
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        // Select random based on weight
        let random = Math.random() * totalWeight;
        for (let i = 0; i < proxies.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return proxies[i];
            }
        }

        return proxies[proxies.length - 1];
    }

    /**
     * Cleanup
     */
    async cleanup(): Promise<void> {
        if (this.scrapeInterval) {
            clearInterval(this.scrapeInterval);
        }
        await this.persistToRedis();
        await this.redis.quit();
        this.isRunning = false;
    }
}

// Export convenience functions
export async function createFreeProxyPool(
    config?: Partial<FreeProxyPoolConfig>
): Promise<FreeProxyPool> {
    const pool = new FreeProxyPool(config);
    await pool.initialize();
    return pool;
}
