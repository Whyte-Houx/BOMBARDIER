/**
 * Free Proxy Scraper - Main Entry Point
 * Provides unified access to free proxy sources
 */

export * from './types.js';
export * from './scraper.js';
export * from './validator.js';
export * from './pool.js';
export * from './tor.js';

import { FreeProxyPool, createFreeProxyPool } from './pool.js';
import { TorManager, createTorManager } from './tor.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Unified Proxy Provider
 * Combines free proxy scraping with Tor for maximum availability
 */
export class UnifiedProxyProvider {
    private freePool: FreeProxyPool;
    private torManager: TorManager;
    private useTor: boolean;
    private preferTor: boolean;

    constructor(options: {
        useTor?: boolean;
        preferTor?: boolean;
        redisUrl?: string;
    } = {}) {
        this.useTor = options.useTor ?? true;
        this.preferTor = options.preferTor ?? false;
        this.freePool = new FreeProxyPool({
            redisUrl: options.redisUrl,
        });
        this.torManager = new TorManager();
    }

    /**
     * Initialize all proxy sources
     */
    async initialize(): Promise<void> {
        logger.info('Initializing unified proxy provider...');

        // Initialize free proxy pool
        await this.freePool.initialize();

        // Initialize Tor if enabled
        if (this.useTor) {
            try {
                await this.torManager.start();
                logger.info('Tor initialized successfully');
            } catch (err) {
                logger.warn({ err }, 'Failed to initialize Tor, continuing with free proxies only');
            }
        }

        logger.info('Unified proxy provider ready');
    }

    /**
     * Get a proxy (Tor or free)
     */
    async getProxy(options: {
        sessionId?: string;
        useTor?: boolean;
        protocol?: 'http' | 'https' | 'socks4' | 'socks5';
    } = {}): Promise<{ url: string; type: 'tor' | 'free'; host: string; port: number } | null> {
        const shouldUseTor = options.useTor ?? this.preferTor;

        // Try Tor first if preferred
        if (shouldUseTor && this.torManager.isActive()) {
            return {
                url: this.torManager.getProxyUrl(),
                type: 'tor',
                host: '127.0.0.1',
                port: 9050,
            };
        }

        // Fallback to free proxy pool
        const freeProxy = await this.freePool.acquireProxy({
            sessionId: options.sessionId,
            protocol: options.protocol,
        });

        if (freeProxy) {
            const protocol = freeProxy.protocol === 'socks5' || freeProxy.protocol === 'socks4'
                ? freeProxy.protocol
                : 'http';

            return {
                url: `${protocol}://${freeProxy.host}:${freeProxy.port}`,
                type: 'free',
                host: freeProxy.host,
                port: freeProxy.port,
            };
        }

        // Last resort: try Tor even if not preferred
        if (this.useTor && this.torManager.isActive()) {
            return {
                url: this.torManager.getProxyUrl(),
                type: 'tor',
                host: '127.0.0.1',
                port: 9050,
            };
        }

        return null;
    }

    /**
     * Rotate proxy (get new IP)
     */
    async rotate(type: 'tor' | 'free' = 'tor'): Promise<boolean> {
        if (type === 'tor' && this.torManager.isActive()) {
            return this.torManager.rotateCircuit();
        }

        // For free proxies, just get a new one
        return true;
    }

    /**
     * Report proxy usage
     */
    async reportUsage(
        host: string,
        port: number,
        success: boolean,
        responseTime?: number
    ): Promise<void> {
        // Skip if it's Tor
        if (host === '127.0.0.1' && (port === 9050 || port === 9051)) {
            return;
        }

        await this.freePool.reportUsage(host, port, success, responseTime);
    }

    /**
     * Get statistics
     */
    getStats(): {
        freeProxies: {
            working: number;
            avgResponseTime: number;
        };
        tor: {
            isActive: boolean;
            currentIp?: string;
        };
    } {
        const freeStats = this.freePool.getStats();

        return {
            freeProxies: {
                working: freeStats.working,
                avgResponseTime: freeStats.avgResponseTime,
            },
            tor: {
                isActive: this.torManager.isActive(),
            },
        };
    }

    /**
     * Cleanup
     */
    async cleanup(): Promise<void> {
        await this.freePool.cleanup();
        await this.torManager.stop();
    }
}

/**
 * Create and initialize unified proxy provider
 */
export async function createUnifiedProxyProvider(options?: {
    useTor?: boolean;
    preferTor?: boolean;
    redisUrl?: string;
}): Promise<UnifiedProxyProvider> {
    const provider = new UnifiedProxyProvider(options);
    await provider.initialize();
    return provider;
}

// CLI for testing
if (require.main === module) {
    (async () => {
        console.log('🌐 Free Proxy Scraper - Starting...\n');

        const provider = await createUnifiedProxyProvider({
            useTor: false, // Set to true if Tor is installed
            preferTor: false,
        });

        const stats = provider.getStats();
        console.log('📊 Stats:', stats);

        // Get a proxy
        const proxy = await provider.getProxy();
        console.log('🔗 Acquired proxy:', proxy);

        await provider.cleanup();
        console.log('\n✅ Done!');
    })();
}
