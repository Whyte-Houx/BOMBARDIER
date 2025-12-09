/**
 * Free Proxy Scraper
 * Scrapes proxies from multiple free public sources
 */

import pino from 'pino';
import type {
    ScrapedProxy,
    ProxySource,
    ProxySourceConfig,
    ProxyProtocol,
    ProxyAnonymity,
} from './types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Free proxy list sources
const PROXY_SOURCES: ProxySourceConfig[] = [
    {
        name: 'free-proxy-list',
        url: 'https://free-proxy-list.net/',
        enabled: true,
        rateLimit: 5000,
        parseFunction: 'parseFreeProxyList',
        requiresBrowser: false,
    },
    {
        name: 'geonode',
        url: 'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
        enabled: true,
        rateLimit: 3000,
        parseFunction: 'parseGeonode',
        requiresBrowser: false,
    },
    {
        name: 'proxyscrape',
        url: (protocol: string) => `https://api.proxyscrape.com/v2/?request=displayproxies&protocol=${protocol}&timeout=10000&country=all&ssl=all&anonymity=all`,
        enabled: true,
        rateLimit: 2000,
        parseFunction: 'parseProxyScrape',
        requiresBrowser: false,
    },
    {
        name: 'spys-one',
        url: 'https://spys.one/en/free-proxy-list/',
        enabled: true,
        rateLimit: 10000,
        parseFunction: 'parseSpysOne',
        requiresBrowser: true, // Requires JavaScript
    },
    {
        name: 'proxy-list-download',
        url: (type: string) => `https://www.proxy-list.download/api/v1/get?type=${type}`,
        enabled: true,
        rateLimit: 3000,
        parseFunction: 'parseProxyListDownload',
        requiresBrowser: false,
    },
    {
        name: 'github-proxies',
        url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        enabled: true,
        rateLimit: 1000,
        parseFunction: 'parseGithubProxies',
        requiresBrowser: false,
    },
];

export class ProxyScraper {
    private proxies: Map<string, ScrapedProxy> = new Map();
    private lastScrape: Map<ProxySource, Date> = new Map();

    /**
     * Scrape proxies from all enabled sources
     */
    async scrapeAll(): Promise<ScrapedProxy[]> {
        const allProxies: ScrapedProxy[] = [];

        for (const source of PROXY_SOURCES) {
            if (!source.enabled) continue;

            try {
                const proxies = await this.scrapeSource(source);
                allProxies.push(...proxies);
                logger.info(
                    { source: source.name, count: proxies.length },
                    'Scraped proxies from source'
                );
            } catch (err) {
                logger.error({ err, source: source.name }, 'Failed to scrape source');
            }

            // Rate limiting between sources
            await this.sleep(source.rateLimit);
        }

        // Deduplicate
        for (const proxy of allProxies) {
            const key = `${proxy.host}:${proxy.port}`;
            if (!this.proxies.has(key)) {
                this.proxies.set(key, proxy);
            }
        }

        logger.info(
            {
                totalScraped: allProxies.length,
                uniqueProxies: this.proxies.size,
            },
            'Scraping complete'
        );

        return Array.from(this.proxies.values());
    }

    /**
     * Scrape proxies from a specific source
     */
    async scrapeSource(source: ProxySourceConfig): Promise<ScrapedProxy[]> {
        logger.debug({ source: source.name }, 'Scraping source');

        switch (source.name) {
            case 'free-proxy-list':
                return this.scrapeFreeProxyList();
            case 'geonode':
                return this.scrapeGeonode();
            case 'proxyscrape':
                return this.scrapeProxyScrape();
            case 'proxy-list-download':
                return this.scrapeProxyListDownload();
            case 'github-proxies':
                return this.scrapeGithubProxies();
            default:
                logger.warn({ source: source.name }, 'Unknown source');
                return [];
        }
    }

    /**
     * Scrape free-proxy-list.net
     */
    private async scrapeFreeProxyList(): Promise<ScrapedProxy[]> {
        const proxies: ScrapedProxy[] = [];

        try {
            const response = await fetch('https://free-proxy-list.net/', {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            const html = await response.text();

            // Parse table rows using regex (simple approach)
            const tableRegex =
                /<tr><td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td><td>(\w+)<\/td><td class="hm">(\w+)<\/td><td>([^<]+)<\/td><td class="hm">([^<]+)<\/td><td class="hx">([^<]+)<\/td><td class="hm">([^<]+)<\/td><\/tr>/g;

            let match;
            while ((match = tableRegex.exec(html)) !== null) {
                const [_, ip, port, countryCode, anonymity, google, https, lastCheck, speed] = match;

                proxies.push({
                    host: ip,
                    port: parseInt(port, 10),
                    protocol: https === 'yes' ? 'https' : 'http',
                    country: countryCode,
                    anonymity: this.parseAnonymity(anonymity),
                    source: 'free-proxy-list',
                    scrapedAt: new Date(),
                });
            }

            // Fallback: Try parsing with simpler regex if table regex fails
            if (proxies.length === 0) {
                const ipPortRegex = /(\d+\.\d+\.\d+\.\d+):(\d+)/g;
                while ((match = ipPortRegex.exec(html)) !== null) {
                    proxies.push({
                        host: match[1],
                        port: parseInt(match[2], 10),
                        protocol: 'http',
                        source: 'free-proxy-list',
                        scrapedAt: new Date(),
                    });
                }
            }
        } catch (err) {
            logger.error({ err }, 'Failed to scrape free-proxy-list');
        }

        return proxies;
    }

    /**
     * Scrape Geonode API
     */
    private async scrapeGeonode(): Promise<ScrapedProxy[]> {
        const proxies: ScrapedProxy[] = [];

        try {
            for (let page = 1; page <= 5; page++) {
                const url = `https://proxylist.geonode.com/api/proxy-list?limit=100&page=${page}&sort_by=lastChecked&sort_type=desc`;

                const response = await fetch(url, {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                const data = await response.json() as { data: Array<{ ip: string; port: string; protocols?: string[]; country?: string; anonymityLevel?: string }> };

                if (!data.data || data.data.length === 0) break;

                for (const proxy of data.data) {
                    proxies.push({
                        host: proxy.ip,
                        port: parseInt(proxy.port, 10),
                        protocol: this.parseProtocol(proxy.protocols?.[0] ?? 'http'),
                        country: proxy.country,
                        anonymity: this.parseAnonymity(proxy.anonymityLevel),
                        source: 'geonode',
                        scrapedAt: new Date(),
                    });
                }

                await this.sleep(1000);
            }
        } catch (err) {
            logger.error({ err }, 'Failed to scrape Geonode');
        }

        return proxies;
    }

    /**
     * Scrape ProxyScrape API
     */
    private async scrapeProxyScrape(): Promise<ScrapedProxy[]> {
        const proxies: ScrapedProxy[] = [];
        const protocols: ProxyProtocol[] = ['http', 'socks4', 'socks5'];

        for (const protocol of protocols) {
            try {
                const url = `https://api.proxyscrape.com/v2/?request=displayproxies&protocol=${protocol}&timeout=10000&country=all&ssl=all&anonymity=all`;

                const response = await fetch(url, {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                const text = await response.text();
                const lines = text.split('\n').filter((line) => line.trim());

                for (const line of lines) {
                    const [host, portStr] = line.trim().split(':');
                    if (host && portStr) {
                        const port = parseInt(portStr, 10);
                        if (!isNaN(port)) {
                            proxies.push({
                                host,
                                port,
                                protocol,
                                source: 'proxyscrape',
                                scrapedAt: new Date(),
                            });
                        }
                    }
                }

                await this.sleep(500);
            } catch (err) {
                logger.error({ err, protocol }, 'Failed to scrape ProxyScrape');
            }
        }

        return proxies;
    }

    /**
     * Scrape proxy-list.download
     */
    private async scrapeProxyListDownload(): Promise<ScrapedProxy[]> {
        const proxies: ScrapedProxy[] = [];
        const types = ['http', 'https', 'socks4', 'socks5'];

        for (const type of types) {
            try {
                const url = `https://www.proxy-list.download/api/v1/get?type=${type}`;

                const response = await fetch(url, {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                const text = await response.text();
                const lines = text.split('\n').filter((line) => line.trim());

                for (const line of lines) {
                    const [host, portStr] = line.trim().split(':');
                    if (host && portStr) {
                        const port = parseInt(portStr, 10);
                        if (!isNaN(port)) {
                            proxies.push({
                                host,
                                port,
                                protocol: type as ProxyProtocol,
                                source: 'proxy-list-download',
                                scrapedAt: new Date(),
                            });
                        }
                    }
                }

                await this.sleep(500);
            } catch (err) {
                logger.error({ err, type }, 'Failed to scrape proxy-list-download');
            }
        }

        return proxies;
    }

    /**
     * Scrape GitHub proxy lists
     */
    private async scrapeGithubProxies(): Promise<ScrapedProxy[]> {
        const proxies: ScrapedProxy[] = [];

        const sources = [
            {
                url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
                protocol: 'http' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
                protocol: 'socks4' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
                protocol: 'socks5' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
                protocol: 'http' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
                protocol: 'http' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
                protocol: 'socks4' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
                protocol: 'socks5' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
                protocol: 'socks5' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
                protocol: 'http' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt',
                protocol: 'socks4' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
                protocol: 'socks5' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
                protocol: 'http' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
                protocol: 'socks4' as ProxyProtocol,
            },
            {
                url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
                protocol: 'socks5' as ProxyProtocol,
            },
        ];

        for (const source of sources) {
            try {
                const response = await fetch(source.url, {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                if (!response.ok) continue;

                const text = await response.text();
                const lines = text.split('\n').filter((line) => line.trim());

                for (const line of lines) {
                    const [host, portStr] = line.trim().split(':');
                    if (host && portStr) {
                        const port = parseInt(portStr, 10);
                        if (!isNaN(port) && port > 0 && port < 65536) {
                            proxies.push({
                                host,
                                port,
                                protocol: source.protocol,
                                source: 'github-proxies',
                                scrapedAt: new Date(),
                            });
                        }
                    }
                }

                await this.sleep(200);
            } catch (err) {
                logger.debug({ url: source.url }, 'Failed to fetch GitHub proxy list');
            }
        }

        return proxies;
    }

    /**
     * Get all scraped proxies
     */
    getProxies(): ScrapedProxy[] {
        return Array.from(this.proxies.values());
    }

    /**
     * Get proxy count
     */
    getCount(): number {
        return this.proxies.size;
    }

    /**
     * Clear all proxies
     */
    clear(): void {
        this.proxies.clear();
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private parseProtocol(protocol: string | undefined): ProxyProtocol {
        const lower = (protocol ?? 'http').toLowerCase();
        if (lower.includes('socks5')) return 'socks5';
        if (lower.includes('socks4')) return 'socks4';
        if (lower.includes('https')) return 'https';
        return 'http';
    }

    private parseAnonymity(level: string | undefined): ProxyAnonymity {
        const lower = level?.toLowerCase() || '';
        if (lower.includes('elite') || lower.includes('high')) return 'elite';
        if (lower.includes('anonymous')) return 'anonymous';
        return 'transparent';
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
