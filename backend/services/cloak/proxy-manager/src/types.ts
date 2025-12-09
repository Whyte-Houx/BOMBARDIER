/**
 * Proxy Manager - Type Definitions
 * Implements sophisticated proxy rotation and health monitoring
 */

export type ProxyType = 'residential' | 'datacenter' | 'mobile' | 'isp';
export type ProxyStatus = 'active' | 'degraded' | 'blocked' | 'cooldown';
export type Geography = 'US' | 'UK' | 'CA' | 'AU' | 'EU' | 'ASIA' | 'GLOBAL';

export interface ProxyConfig {
    id: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    type: ProxyType;
    geography: Geography;
    isp?: string;
    status: ProxyStatus;
    metadata: {
        successRate: number;
        captchaRate: number;
        avgResponseTime: number;
        lastUsed: Date;
        totalRequests: number;
        failedRequests: number;
        blockedAt?: Date;
        cooldownUntil?: Date;
    };
}

export interface ProxyPool {
    type: ProxyType;
    geography: Geography;
    proxies: ProxyConfig[];
    rotationStrategy: 'round-robin' | 'least-used' | 'performance-based';
}

export interface ProxyAcquisitionOptions {
    geography?: Geography;
    type?: ProxyType;
    sessionId?: string; // For session persistence
    excludeIds?: string[]; // Exclude specific proxies
    minSuccessRate?: number;
    maxCaptchaRate?: number;
}

export interface ProxyHealthReport {
    totalProxies: number;
    activeProxies: number;
    degradedProxies: number;
    blockedProxies: number;
    avgSuccessRate: number;
    avgCaptchaRate: number;
    poolHealth: {
        [key: string]: {
            type: ProxyType;
            geography: Geography;
            count: number;
            avgSuccessRate: number;
        };
    };
}

export interface ProxyUsageStats {
    proxyId: string;
    requestCount: number;
    successCount: number;
    failureCount: number;
    captchaCount: number;
    avgResponseTime: number;
    lastError?: string;
    lastErrorAt?: Date;
}
