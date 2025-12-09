/**
 * Free Proxy Scraper - Type Definitions
 * Scrapes and validates free proxies from public sources
 */

export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';
export type ProxyAnonymity = 'transparent' | 'anonymous' | 'elite';
export type ProxySource =
    | 'free-proxy-list'
    | 'geonode'
    | 'proxyscrape'
    | 'spys-one'
    | 'proxy-list-download'
    | 'proxyspace'
    | 'openproxy'
    | 'github-proxies'
    | 'tor';

export interface ScrapedProxy {
    host: string;
    port: number;
    protocol: ProxyProtocol;
    country?: string;
    anonymity?: ProxyAnonymity;
    source: ProxySource;
    scrapedAt: Date;
}

export interface ValidatedProxy extends ScrapedProxy {
    isWorking: boolean;
    responseTime: number; // ms
    lastChecked: Date;
    consecutiveFailures: number;
    totalChecks: number;
    successfulChecks: number;
    externalIp?: string;
}

export interface ProxySourceConfig {
    name: ProxySource;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: string | ((param: any) => string);
    enabled: boolean;
    rateLimit: number; // ms between requests
    parseFunction: string; // Name of parsing function
    requiresBrowser: boolean;
}

export interface ScraperConfig {
    sources: ProxySourceConfig[];
    validateConcurrency: number;
    scrapeIntervalMinutes: number;
    validationTimeoutMs: number;
    maxConsecutiveFailures: number;
    minSuccessRate: number;
}

export interface ProxyStats {
    totalScraped: number;
    totalValidated: number;
    workingProxies: number;
    byProtocol: Record<ProxyProtocol, number>;
    byCountry: Record<string, number>;
    byAnonymity: Record<ProxyAnonymity, number>;
    avgResponseTime: number;
}
