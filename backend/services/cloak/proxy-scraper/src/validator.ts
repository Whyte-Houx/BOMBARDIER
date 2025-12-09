/**
 * Proxy Validator
 * Validates scraped proxies for functionality and performance
 */

import pino from 'pino';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ScrapedProxy, ValidatedProxy, ProxyProtocol } from './types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Test URLs for validation
const TEST_URL = 'https://api.ipify.org?format=json';
const FALLBACK_TEST_URLS = [
    'https://httpbin.org/ip',
    'https://icanhazip.com',
    'https://ifconfig.me/ip',
];

export interface ValidationOptions {
    timeout: number; // ms
    retries: number;
    concurrency: number;
}

const DEFAULT_OPTIONS: ValidationOptions = {
    timeout: 10000,
    retries: 1,
    concurrency: 50,
};

export class ProxyValidator {
    private options: ValidationOptions;
    private validatedProxies: Map<string, ValidatedProxy> = new Map();

    constructor(options: Partial<ValidationOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Validate a list of proxies
     */
    async validateAll(proxies: ScrapedProxy[]): Promise<ValidatedProxy[]> {
        logger.info({ count: proxies.length }, 'Starting proxy validation');

        const results: ValidatedProxy[] = [];
        const chunks = this.chunk(proxies, this.options.concurrency);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkResults = await Promise.all(
                chunk.map((proxy) => this.validate(proxy))
            );

            results.push(...chunkResults);

            logger.debug(
                {
                    chunk: i + 1,
                    total: chunks.length,
                    working: chunkResults.filter((p) => p.isWorking).length,
                },
                'Chunk validation complete'
            );
        }

        // Store validated proxies
        for (const proxy of results) {
            if (proxy.isWorking) {
                const key = `${proxy.host}:${proxy.port}`;
                this.validatedProxies.set(key, proxy);
            }
        }

        const workingCount = results.filter((p) => p.isWorking).length;
        logger.info(
            {
                total: results.length,
                working: workingCount,
                rate: ((workingCount / results.length) * 100).toFixed(1) + '%',
            },
            'Proxy validation complete'
        );

        return results;
    }

    /**
     * Validate a single proxy
     */
    async validate(proxy: ScrapedProxy): Promise<ValidatedProxy> {
        const startTime = Date.now();
        let isWorking = false;
        let responseTime = 0;
        let externalIp: string | undefined;
        let error: string | undefined;

        for (let attempt = 0; attempt <= this.options.retries; attempt++) {
            try {
                const result = await this.testProxy(proxy);
                isWorking = result.success;
                responseTime = result.responseTime;
                externalIp = result.externalIp;

                if (isWorking) break;
            } catch (err: any) {
                error = err.message;
            }
        }

        const validated: ValidatedProxy = {
            ...proxy,
            isWorking,
            responseTime,
            lastChecked: new Date(),
            consecutiveFailures: isWorking ? 0 : 1,
            totalChecks: 1,
            successfulChecks: isWorking ? 1 : 0,
            externalIp,
        };

        return validated;
    }

    /**
     * Test proxy connection
     */
    private async testProxy(
        proxy: ScrapedProxy
    ): Promise<{ success: boolean; responseTime: number; externalIp?: string }> {
        const startTime = Date.now();

        try {
            const agent = this.createAgent(proxy);
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                this.options.timeout
            );

            try {
                const response = await fetch(TEST_URL, {
                    method: 'GET',
                    // @ts-ignore - agent is valid
                    agent,
                    signal: controller.signal,
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    return { success: false, responseTime: 0 };
                }

                const data = await response.json() as { ip?: string; origin?: string };
                const responseTime = Date.now() - startTime;

                return {
                    success: true,
                    responseTime,
                    externalIp: data.ip || data.origin,
                };
            } catch (fetchError) {
                clearTimeout(timeout);
                throw fetchError;
            }
        } catch (err) {
            return { success: false, responseTime: 0 };
        }
    }

    /**
     * Create appropriate agent for proxy type
     */
    private createAgent(proxy: ScrapedProxy): any {
        const proxyUrl = this.buildProxyUrl(proxy);

        if (proxy.protocol === 'socks4' || proxy.protocol === 'socks5') {
            return new SocksProxyAgent(proxyUrl);
        }

        return new HttpsProxyAgent(proxyUrl);
    }

    /**
     * Build proxy URL
     */
    private buildProxyUrl(proxy: ScrapedProxy): string {
        const protocol =
            proxy.protocol === 'socks4' || proxy.protocol === 'socks5'
                ? proxy.protocol
                : 'http';

        return `${protocol}://${proxy.host}:${proxy.port}`;
    }

    /**
     * Get all validated working proxies
     */
    getWorkingProxies(): ValidatedProxy[] {
        return Array.from(this.validatedProxies.values()).filter(
            (p) => p.isWorking
        );
    }

    /**
     * Get proxies by protocol
     */
    getProxiesByProtocol(protocol: ProxyProtocol): ValidatedProxy[] {
        return this.getWorkingProxies().filter((p) => p.protocol === protocol);
    }

    /**
     * Get proxy by performance (fastest first)
     */
    getProxiesBySpeed(): ValidatedProxy[] {
        return this.getWorkingProxies().sort(
            (a, b) => a.responseTime - b.responseTime
        );
    }

    /**
     * Get random working proxy
     */
    getRandomProxy(): ValidatedProxy | null {
        const working = this.getWorkingProxies();
        if (working.length === 0) return null;
        return working[Math.floor(Math.random() * working.length)];
    }

    /**
     * Mark proxy as failed
     */
    markFailed(host: string, port: number): void {
        const key = `${host}:${port}`;
        const proxy = this.validatedProxies.get(key);

        if (proxy) {
            proxy.consecutiveFailures++;
            proxy.totalChecks++;
            proxy.lastChecked = new Date();

            // Remove if too many failures
            if (proxy.consecutiveFailures >= 3) {
                this.validatedProxies.delete(key);
                logger.debug({ key }, 'Removed proxy due to consecutive failures');
            }
        }
    }

    /**
     * Mark proxy as success
     */
    markSuccess(host: string, port: number, responseTime: number): void {
        const key = `${host}:${port}`;
        const proxy = this.validatedProxies.get(key);

        if (proxy) {
            proxy.consecutiveFailures = 0;
            proxy.successfulChecks++;
            proxy.totalChecks++;
            proxy.responseTime =
                (proxy.responseTime + responseTime) / 2; // Moving average
            proxy.lastChecked = new Date();
        }
    }

    /**
     * Get stats
     */
    getStats(): {
        total: number;
        working: number;
        avgResponseTime: number;
        byProtocol: Record<ProxyProtocol, number>;
    } {
        const working = this.getWorkingProxies();
        const avgResponseTime =
            working.length > 0
                ? working.reduce((sum, p) => sum + p.responseTime, 0) / working.length
                : 0;

        const byProtocol: Record<ProxyProtocol, number> = {
            http: 0,
            https: 0,
            socks4: 0,
            socks5: 0,
        };

        for (const proxy of working) {
            byProtocol[proxy.protocol]++;
        }

        return {
            total: this.validatedProxies.size,
            working: working.length,
            avgResponseTime: Math.round(avgResponseTime),
            byProtocol,
        };
    }

    /**
     * Clear all proxies
     */
    clear(): void {
        this.validatedProxies.clear();
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private chunk<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
