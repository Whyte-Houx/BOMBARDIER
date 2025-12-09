/**
 * Cloak Worker Integration
 * Provides easy-to-use cloak capabilities for worker processes
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// API endpoints
const CLOAK_API_URL = process.env.CLOAK_API_URL || 'http://localhost:4050/cloak';
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:5100';

// ============================================================================
// Types
// ============================================================================

export interface CloakOptions {
    useFingerprint?: boolean;
    useProxy?: boolean;
    proxyType?: 'residential' | 'datacenter' | 'tor' | 'free';
    geography?: string;
    useTiming?: boolean;
    useLocationSpoof?: boolean;
    accountId?: string;
}

export interface CloakedSession {
    sessionId: string;
    fingerprint?: {
        id: string;
        userAgent: string;
        platform: string;
    };
    proxy?: {
        id: string;
        url: string;
        type: string;
        geography: string;
    };
    location?: {
        country: string;
        city: string;
        timezone: string;
    };
    timing?: {
        baseDelay: number;
        variance: number;
    };
}

// ============================================================================
// Main Integration Class
// ============================================================================

export class CloakWorkerIntegration {
    private apiUrl: string;
    private browserServiceUrl: string;

    constructor(apiUrl?: string, browserServiceUrl?: string) {
        this.apiUrl = apiUrl || CLOAK_API_URL;
        this.browserServiceUrl = browserServiceUrl || BROWSER_SERVICE_URL;
    }

    /**
     * Get a cloaked session for automation
     */
    async getCloakedSession(options: CloakOptions = {}): Promise<CloakedSession> {
        logger.info({ options }, 'Getting cloaked session');

        const session: CloakedSession = {
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };

        try {
            // Get fingerprint
            if (options.useFingerprint !== false) {
                const fingerprint = await this.generateFingerprint();
                session.fingerprint = fingerprint;
            }

            // Get proxy
            if (options.useProxy !== false) {
                const proxy = await this.acquireProxy({
                    type: options.proxyType || 'free',
                    geography: options.geography,
                });
                session.proxy = proxy;
            }

            // Check account warming limits
            if (options.accountId) {
                const allowed = await this.checkAccountLimits(options.accountId);
                if (!allowed) {
                    logger.warn({ accountId: options.accountId }, 'Account warming limit reached');
                }
            }

            // Get timing configuration
            if (options.useTiming !== false) {
                session.timing = {
                    baseDelay: 3000 + Math.random() * 5000,
                    variance: 0.3 + Math.random() * 0.2,
                };
            }

            logger.info({ sessionId: session.sessionId }, 'Cloaked session created');
            return session;

        } catch (err) {
            logger.error({ err }, 'Failed to create cloaked session');
            throw err;
        }
    }

    /**
     * Generate a fingerprint
     */
    async generateFingerprint(): Promise<CloakedSession['fingerprint']> {
        try {
            const response = await fetch(`${this.apiUrl}/fingerprint/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to generate fingerprint: ${response.status}`);
            }

            const data = await response.json() as any;
            return {
                id: data.id,
                userAgent: data.userAgent,
                platform: data.platform,
            };
        } catch (err) {
            logger.warn({ err }, 'Using fallback fingerprint');
            return {
                id: `fp_fallback_${Date.now()}`,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                platform: 'Win32',
            };
        }
    }

    /**
     * Acquire a proxy
     */
    async acquireProxy(options: { type?: string; geography?: string }): Promise<CloakedSession['proxy']> {
        try {
            const response = await fetch(`${this.apiUrl}/proxy/acquire`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options),
            });

            if (!response.ok) {
                throw new Error(`Failed to acquire proxy: ${response.status}`);
            }

            const data = await response.json() as any;
            return {
                id: data.id,
                url: data.url,
                type: data.type,
                geography: data.geography,
            };
        } catch (err) {
            logger.warn({ err }, 'Using no proxy (direct connection)');
            return undefined;
        }
    }

    /**
     * Check account warming limits
     */
    async checkAccountLimits(accountId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/status`);
            if (!response.ok) return true;

            const data = await response.json() as any;
            const account = data.accounts?.find((a: any) => a.id === accountId);

            if (!account) return true;

            return account.todayActions < account.maxActions;
        } catch (err) {
            logger.warn({ err }, 'Could not check account limits');
            return true;
        }
    }

    /**
     * Record an action for account warming
     */
    async recordAction(accountId: string, actionType: string): Promise<void> {
        try {
            // In real implementation, this would call the account warming API
            logger.debug({ accountId, actionType }, 'Action recorded');
        } catch (err) {
            logger.warn({ err }, 'Failed to record action');
        }
    }

    /**
     * Get timing delay for human-like pacing
     */
    async getDelay(session: CloakedSession, actionType?: string): Promise<number> {
        if (!session.timing) {
            return 1000 + Math.random() * 2000;
        }

        const { baseDelay, variance } = session.timing;
        const varianceFactor = 1 + (Math.random() - 0.5) * 2 * variance;

        // Adjust for action type
        const typeMultipliers: Record<string, number> = {
            click: 0.5,
            scroll: 0.3,
            type: 1.5,
            message: 2.0,
            navigate: 1.0,
        };

        const multiplier = typeMultipliers[actionType || 'navigate'] || 1.0;
        return Math.round(baseDelay * varianceFactor * multiplier);
    }

    /**
     * Sleep with human-like delay
     */
    async humanDelay(session: CloakedSession, actionType?: string): Promise<void> {
        const delay = await this.getDelay(session, actionType);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Get cloak system status
     */
    async getStatus(): Promise<any> {
        try {
            const response = await fetch(`${this.apiUrl}/status`);
            if (!response.ok) {
                throw new Error(`Status check failed: ${response.status}`);
            }
            return await response.json();
        } catch (err) {
            logger.error({ err }, 'Failed to get cloak status');
            return null;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalInstance: CloakWorkerIntegration | null = null;

export function getCloakIntegration(): CloakWorkerIntegration {
    if (!globalInstance) {
        globalInstance = new CloakWorkerIntegration();
    }
    return globalInstance;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick helper to get a cloaked session
 */
export async function getCloakedSession(options?: CloakOptions): Promise<CloakedSession> {
    return getCloakIntegration().getCloakedSession(options);
}

/**
 * Quick helper for human-like delay
 */
export async function humanDelay(session: CloakedSession, actionType?: string): Promise<void> {
    return getCloakIntegration().humanDelay(session, actionType);
}
