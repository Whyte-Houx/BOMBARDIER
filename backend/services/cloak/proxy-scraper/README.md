# Free Proxy Scraper & Tor Integration

A comprehensive free proxy solution for the Bombardier project, designed to provide proxies without any paid services.

## 🎯 Overview

This module provides **three proxy sources** at no cost:

1. **Free Proxy Scraper** - Scrapes 1000+ proxies from public sources
2. **Tor Integration** - Unlimited free anonymous proxying
3. **Unified Provider** - Combines both for maximum availability

---

## 📦 Components

### 1. Proxy Scraper (`scraper.ts`)

Scrapes proxies from **14+ free sources**:

| Source | Type | Rate Limit | Reliability |
|--------|------|------------|-------------|
| free-proxy-list.net | HTTP/HTTPS | 5s | Medium |
| Geonode API | HTTP/HTTPS/SOCKS | 3s | High |
| ProxyScrape API | HTTP/SOCKS4/SOCKS5 | 2s | High |
| proxy-list.download | HTTP/HTTPS/SOCKS | 3s | Medium |
| TheSpeedX/PROXY-List | HTTP/SOCKS4/SOCKS5 | 1s | High |
| clarketm/proxy-list | HTTP | 1s | Medium |
| ShiftyTR/Proxy-List | HTTP/SOCKS | 1s | Medium |
| hookzof/socks5_list | SOCKS5 | 1s | Medium |
| jetkai/proxy-list | HTTP/SOCKS | 1s | High |
| monosans/proxy-list | HTTP/SOCKS | 1s | High |

**Typical Yield:** 1,000-5,000 proxies per scrape  
**Working After Validation:** 100-500 proxies (5-10%)

### 2. Proxy Validator (`validator.ts`)

Validates scraped proxies:

- **Concurrent Testing:** Tests 50 proxies simultaneously
- **Response Time Tracking:** Measures latency
- **External IP Verification:** Confirms IP masking
- **Automatic Failure Tracking:** Removes dead proxies

### 3. Free Proxy Pool (`pool.ts`)

Manages validated proxies:

- **Redis Persistence:** Survives restarts
- **Session Binding:** Same proxy per session
- **Weighted Selection:** Favors faster proxies
- **Auto-Refresh:** Scrapes when pool is low
- **Age Expiration:** Removes stale proxies

### 4. Tor Integration (`tor.ts`)

Free anonymous proxying via Tor:

- **Process Management:** Starts/stops Tor daemon
- **Circuit Rotation:** Gets new IP every 10 minutes
- **Connection Verification:** Confirms Tor connectivity
- **SOCKS5 Proxy:** Works with any HTTP client

---

## 🚀 Quick Start

### Installation

```bash
cd backend/services/proxy-scraper
npm install
```

### Basic Usage

```typescript
import { createUnifiedProxyProvider } from '@bombardier/proxy-scraper';

// Initialize provider
const provider = await createUnifiedProxyProvider({
    useTor: true,      // Enable Tor (requires Tor installed)
    preferTor: false,  // Use free proxies first, Tor as fallback
});

// Get a proxy
const proxy = await provider.getProxy();
console.log(proxy);
// { url: 'http://185.xxx.xxx.xxx:8080', type: 'free', host: '185.xxx.xxx.xxx', port: 8080 }

// Use with fetch
const response = await fetch('https://api.ipify.org', {
    agent: new HttpsProxyAgent(proxy.url)
});

// Report success/failure
await provider.reportUsage(proxy.host, proxy.port, true, 450);

// Cleanup
await provider.cleanup();
```

### With Session Persistence

```typescript
// Same session gets same proxy
const proxy1 = await provider.getProxy({ sessionId: 'user-123' });
const proxy2 = await provider.getProxy({ sessionId: 'user-123' });
// proxy1 === proxy2 (same proxy)
```

### Tor-Only Mode

```typescript
const provider = await createUnifiedProxyProvider({
    useTor: true,
    preferTor: true,  // Always use Tor when available
});

// Rotate Tor circuit (get new IP)
await provider.rotate('tor');
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Redis for persistence
REDIS_URL=redis://localhost:6379

# Scraping settings
PROXY_SCRAPE_INTERVAL_MINUTES=30
PROXY_MIN_WORKING=100
PROXY_VALIDATION_TIMEOUT_MS=10000
PROXY_VALIDATION_CONCURRENCY=50

# Tor settings
TOR_SOCKS_PORT=9050
TOR_CONTROL_PORT=9051
TOR_AUTO_ROTATE=true
TOR_ROTATE_INTERVAL_MINUTES=10
```

### Code Configuration

```typescript
import { FreeProxyPool, TorManager } from '@bombardier/proxy-scraper';

// Custom pool config
const pool = new FreeProxyPool({
    redisUrl: 'redis://localhost:6379',
    scrapeIntervalMinutes: 30,
    validateConcurrency: 100,
    minWorkingProxies: 200,
    validationTimeoutMs: 5000,
    maxProxyAge: 12, // hours
});

// Custom Tor config
const tor = new TorManager({
    socksPort: 9050,
    controlPort: 9051,
    maxCircuitDirtiness: 300, // 5 minutes
    autoRotate: true,
    rotateIntervalMinutes: 5,
});
```

---

## 🛠️ Installation Requirements

### For Free Proxy Scraping Only

No special requirements - works out of the box!

### For Tor Integration

Install Tor on your system:

**macOS:**

```bash
brew install tor
```

**Ubuntu/Debian:**

```bash
sudo apt-get install tor
```

**Docker:**

```dockerfile
RUN apk add --no-cache tor
```

---

## 📊 Performance Expectations

### Free Proxies

| Metric | Value |
|--------|-------|
| Total Scraped | 1,000-5,000 |
| Working (after validation) | 100-500 |
| Success Rate | 5-10% |
| Avg Response Time | 2-10 seconds |
| Lifetime | 1-24 hours |
| Best For | Testing, non-critical tasks |

### Tor

| Metric | Value |
|--------|-------|
| Availability | 99.9% (when Tor is running) |
| Response Time | 2-5 seconds |
| IP Rotation | Every 10 minutes (configurable) |
| Anonymity | High (exit node location varies) |
| Best For | Anonymity, reliability |

---

## ⚠️ Limitations

### Free Proxies

1. **Low Success Rate** - Only 5-10% of scraped proxies work
2. **Short Lifespan** - Many die within hours
3. **Slow** - 2-10 second response times
4. **Unpredictable** - Quality varies significantly
5. **May Be Blacklisted** - Public proxies are often blocked

### Tor

1. **Slow** - 2-5 second latency
2. **Detectable** - Tor exit nodes are public and may be blocked
3. **Exit Node Variability** - Location changes randomly
4. **Requires Installation** - Needs Tor daemon

---

## 🔄 Integration with Bombardier

### Update Proxy Manager to Use Free Proxies

```typescript
// backend/services/proxy-manager/src/proxy-manager.ts

import { createUnifiedProxyProvider } from '@bombardier/proxy-scraper';

export class ProxyManager {
    private freeProvider: UnifiedProxyProvider;

    async initialize() {
        // Initialize free proxy provider as fallback
        this.freeProvider = await createUnifiedProxyProvider({
            useTor: true,
            preferTor: false,
        });
    }

    async acquireProxy(options) {
        // Try paid proxies first (if configured)
        const paidProxy = await this.tryPaidPool(options);
        if (paidProxy) return paidProxy;

        // Fallback to free proxies
        const freeProxy = await this.freeProvider.getProxy({
            sessionId: options.sessionId,
        });

        if (freeProxy) {
            return {
                id: `free-${freeProxy.host}:${freeProxy.port}`,
                host: freeProxy.host,
                port: freeProxy.port,
                type: 'datacenter', // Free proxies are usually datacenter
                geography: 'GLOBAL',
                status: 'active',
                metadata: {
                    isFree: true,
                    source: freeProxy.type,
                    successRate: 0.5,
                    captchaRate: 0.3,
                    avgResponseTime: 5000,
                },
            };
        }

        throw new Error('No proxies available');
    }
}
```

### Use with Browser Service

```typescript
// backend/browser-service/src/lib/browser-pool.ts

import { createUnifiedProxyProvider } from '@bombardier/proxy-scraper';

const proxyProvider = await createUnifiedProxyProvider();

async function acquireContext() {
    const proxy = await proxyProvider.getProxy();

    const context = await browser.newContext({
        proxy: {
            server: proxy.url,
        },
    });

    return context;
}
```

---

## 🧪 Testing

### Run Scraper Manually

```bash
cd backend/services/proxy-scraper
npm run scrape
```

### Test Specific Source

```typescript
import { ProxyScraper } from '@bombardier/proxy-scraper';

const scraper = new ProxyScraper();
const proxies = await scraper.scrapeGithubProxies();
console.log(`Found ${proxies.length} proxies`);
```

### Validate Proxies

```typescript
import { ProxyValidator } from '@bombardier/proxy-scraper';

const validator = new ProxyValidator({
    timeout: 5000,
    concurrency: 100,
});

const validated = await validator.validateAll(proxies);
console.log(`Working: ${validated.filter(p => p.isWorking).length}`);
```

### Test Tor Connection

```typescript
import { TorManager } from '@bombardier/proxy-scraper';

const tor = new TorManager();
await tor.start();

const ip = await tor.getCurrentIp();
console.log(`Tor IP: ${ip}`);

await tor.rotateCircuit();
const newIp = await tor.getCurrentIp();
console.log(`New IP: ${newIp}`);

await tor.stop();
```

---

## 🐳 Docker

### Add to docker-compose.yml

```yaml
  proxy-scraper:
    build:
      context: ./backend/services/proxy-scraper
      dockerfile: Dockerfile
    container_name: bombardier-proxy-scraper
    environment:
      - REDIS_URL=redis://redis:6379
      - PROXY_SCRAPE_INTERVAL_MINUTES=30
      - PROXY_MIN_WORKING=100
    depends_on:
      - redis
    networks:
      - bombardier-network
```

### Build and Run

```bash
docker-compose build proxy-scraper
docker-compose up -d proxy-scraper
docker-compose logs -f proxy-scraper
```

---

## 📈 Best Practices

### 1. Combine with Tor for Reliability

```typescript
const provider = await createUnifiedProxyProvider({
    useTor: true,
    preferTor: false, // Use free proxies first
});

// If free proxy fails, automatically falls back to Tor
```

### 2. Report Usage for Self-Healing

```typescript
try {
    const response = await fetch(url, { agent });
    await provider.reportUsage(proxy.host, proxy.port, true, responseTime);
} catch (err) {
    await provider.reportUsage(proxy.host, proxy.port, false);
    // Proxy will be removed after 3 failures
}
```

### 3. Use Session Persistence for Consistency

```typescript
// Same user/session gets same proxy
const proxy = await provider.getProxy({
    sessionId: `user-${userId}`,
});
```

### 4. Prefer SOCKS5 for Better Performance

```typescript
const proxy = await provider.getProxy({
    protocol: 'socks5',
});
```

---

## 🔮 Future Improvements

1. **Browser-Based Scraping** - Scrape sources that require JavaScript
2. **Geographic Intelligence** - Track proxy locations more accurately
3. **Proxy Quality Scoring** - ML-based quality prediction
4. **I2P Integration** - Additional anonymous network option
5. **VPN Integration** - Support for free VPN services (ProtonVPN free tier)

---

## 📚 API Reference

### ProxyScraper

```typescript
class ProxyScraper {
    scrapeAll(): Promise<ScrapedProxy[]>
    scrapeSource(source: ProxySourceConfig): Promise<ScrapedProxy[]>
    getProxies(): ScrapedProxy[]
    getCount(): number
    clear(): void
}
```

### ProxyValidator

```typescript
class ProxyValidator {
    validateAll(proxies: ScrapedProxy[]): Promise<ValidatedProxy[]>
    validate(proxy: ScrapedProxy): Promise<ValidatedProxy>
    getWorkingProxies(): ValidatedProxy[]
    getProxiesByProtocol(protocol: ProxyProtocol): ValidatedProxy[]
    getProxiesBySpeed(): ValidatedProxy[]
    getRandomProxy(): ValidatedProxy | null
    markFailed(host: string, port: number): void
    markSuccess(host: string, port: number, responseTime: number): void
    getStats(): ProxyStats
}
```

### FreeProxyPool

```typescript
class FreeProxyPool {
    initialize(): Promise<void>
    acquireProxy(options: AcquireOptions): Promise<ValidatedProxy | null>
    releaseProxy(sessionId: string): Promise<void>
    reportUsage(host: string, port: number, success: boolean, responseTime?: number): Promise<void>
    getStats(): PoolStats
    getWorkingProxies(): ValidatedProxy[]
    forceRefresh(): Promise<void>
    cleanup(): Promise<void>
}
```

### TorManager

```typescript
class TorManager {
    start(): Promise<boolean>
    stop(): Promise<void>
    rotateCircuit(): Promise<boolean>
    getProxyUrl(): string
    getPlaywrightProxy(): { server: string }
    isActive(): boolean
    getCurrentIp(): Promise<string | null>
}
```

### UnifiedProxyProvider

```typescript
class UnifiedProxyProvider {
    initialize(): Promise<void>
    getProxy(options: GetProxyOptions): Promise<ProxyInfo | null>
    rotate(type: 'tor' | 'free'): Promise<boolean>
    reportUsage(host: string, port: number, success: boolean, responseTime?: number): Promise<void>
    getStats(): UnifiedStats
    cleanup(): Promise<void>
}
```

---

## 🆓 Summary

This free proxy system provides:

✅ **1000+ proxies scraped** from 14+ sources  
✅ **100-500 working proxies** after validation  
✅ **Tor integration** for unlimited anonymous proxying  
✅ **Automatic rotation** and health monitoring  
✅ **Session persistence** for consistent user experience  
✅ **Redis-backed storage** for durability  
✅ **Zero cost** - completely free!

**Trade-offs:**

- Slower than paid proxies (2-10s vs 0.2-0.5s)
- Less reliable (50% success vs 95%+)
- May be blocked on some sites

**Best Use Cases:**

- Development and testing
- Low-volume scraping
- Budget-constrained projects
- Anonymity requirements (Tor)
