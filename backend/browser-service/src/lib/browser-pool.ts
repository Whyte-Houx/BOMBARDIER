/**
 * Browser Pool Manager
 * Per dev_docs - sophisticated browser fingerprint management
 * 
 * Features:
 * - Browser instance pooling
 * - Fingerprint randomization
 * - Stealth mode configuration
 * - Proxy rotation
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// Common screen resolutions for fingerprint randomization
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
];

// User agent strings
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
];

// Timezone/locale combinations
const LOCALES = [
    { timezone: "America/New_York", locale: "en-US" },
    { timezone: "America/Los_Angeles", locale: "en-US" },
    { timezone: "America/Chicago", locale: "en-US" },
    { timezone: "Europe/London", locale: "en-GB" },
    { timezone: "Europe/Berlin", locale: "de-DE" },
];

interface BrowserPoolConfig {
    maxBrowsers: number;
    headless: boolean;
    proxyUrl?: string;
}

interface BrowserInstance {
    id: string;
    browser: Browser;
    activeContexts: number;
    createdAt: Date;
    fingerprint: Fingerprint;
}

interface Fingerprint {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
    timezone: string;
}

export class BrowserPool {
    private config: BrowserPoolConfig;
    private browsers: Map<string, BrowserInstance> = new Map();
    private initialized = false;

    constructor(config: BrowserPoolConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        logger.info("Initializing browser pool...");
        this.initialized = true;
    }

    async acquireContext(options: {
        sessionId?: string;
        proxyUrl?: string;
        cookies?: any[];
    } = {}): Promise<{ id: string; context: BrowserContext; page: Page }> {
        // Get or create a browser instance
        let browserInstance = await this.getOrCreateBrowser();

        // Generate fingerprint for this context
        const fingerprint = this.generateFingerprint();

        // Create context with anti-detection settings
        const contextOptions: any = {
            userAgent: fingerprint.userAgent,
            viewport: fingerprint.viewport,
            locale: fingerprint.locale,
            timezoneId: fingerprint.timezone,
            deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
            hasTouch: Math.random() > 0.8,
            isMobile: false,
            javaScriptEnabled: true,
            bypassCSP: false,
            ignoreHTTPSErrors: true,
        };

        // Add proxy if specified
        const proxyUrl = options.proxyUrl || this.config.proxyUrl;
        if (proxyUrl) {
            contextOptions.proxy = { server: proxyUrl };
        }

        const context = await browserInstance.browser.newContext(contextOptions);
        browserInstance.activeContexts++;

        // Apply stealth scripts
        await this.applyStealthScripts(context);

        // Restore cookies if provided
        if (options.cookies && options.cookies.length > 0) {
            await context.addCookies(options.cookies);
        }

        // Create first page
        const page = await context.newPage();

        // Apply page-level anti-detection
        await this.applyPageStealth(page);

        const contextId = options.sessionId || uuidv4();

        logger.info({ contextId, browserId: browserInstance.id }, "Browser context acquired");

        return { id: contextId, context, page };
    }

    async releaseContext(browserId: string, context: BrowserContext): Promise<void> {
        const instance = this.browsers.get(browserId);
        if (instance) {
            await context.close();
            instance.activeContexts--;

            // Cleanup idle browsers
            if (instance.activeContexts === 0 && this.browsers.size > 1) {
                await instance.browser.close();
                this.browsers.delete(browserId);
                logger.info({ browserId }, "Browser instance closed due to inactivity");
            }
        }
    }

    private async getOrCreateBrowser(): Promise<BrowserInstance> {
        // Find browser with capacity
        for (const instance of this.browsers.values()) {
            if (instance.activeContexts < 5) {  // Max 5 contexts per browser
                return instance;
            }
        }

        // Create new browser if under limit
        if (this.browsers.size < this.config.maxBrowsers) {
            return await this.createBrowser();
        }

        // Wait for capacity
        // In production, implement proper queueing
        throw new Error("Browser pool at capacity");
    }

    private async createBrowser(): Promise<BrowserInstance> {
        const launchOptions: any = {
            headless: this.config.headless,
            args: [
                "--disable-blink-features=AutomationControlled",
                "--disable-features=site-per-process",
                "--disable-infobars",
                "--disable-web-security",
                "--disable-site-isolation-trials",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
            ],
        };

        const browser = await chromium.launch(launchOptions);
        const fingerprint = this.generateFingerprint();

        const instance: BrowserInstance = {
            id: uuidv4(),
            browser,
            activeContexts: 0,
            createdAt: new Date(),
            fingerprint,
        };

        this.browsers.set(instance.id, instance);
        logger.info({ browserId: instance.id }, "New browser instance created");

        return instance;
    }

    private generateFingerprint(): Fingerprint {
        const resolution = SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)];
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const localeConfig = LOCALES[Math.floor(Math.random() * LOCALES.length)];

        return {
            userAgent,
            viewport: resolution,
            locale: localeConfig.locale,
            timezone: localeConfig.timezone,
        };
    }

    private async applyStealthScripts(context: BrowserContext): Promise<void> {
        // Add stealth scripts to all pages
        await context.addInitScript(() => {
            // Override navigator.webdriver
            Object.defineProperty(navigator, "webdriver", {
                get: () => undefined,
            });

            // Override chrome automation detection
            Object.defineProperty(window, "chrome", {
                value: {
                    runtime: {},
                    loadTimes: () => { },
                    csi: () => { },
                    app: {},
                },
                writable: true,
            });

            // Override plugins
            Object.defineProperty(navigator, "plugins", {
                get: () => [
                    { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
                    { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
                    { name: "Native Client", filename: "internal-nacl-plugin" },
                ],
            });

            // Override languages
            Object.defineProperty(navigator, "languages", {
                get: () => ["en-US", "en"],
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters: any) => {
                if (parameters.name === "notifications") {
                    return Promise.resolve({ state: "denied" } as PermissionStatus);
                }
                return originalQuery(parameters);
            };
        });
    }

    private async applyPageStealth(page: Page): Promise<void> {
        // Add mouse movement randomization
        await page.addInitScript(() => {
            // Randomize canvas fingerprint
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
                if (type === "image/png") {
                    const context = this.getContext("2d");
                    if (context) {
                        const imageData = context.getImageData(0, 0, this.width, this.height);
                        for (let i = 0; i < imageData.data.length; i += 4) {
                            imageData.data[i] = imageData.data[i] + (Math.random() * 0.1 - 0.05);
                        }
                        context.putImageData(imageData, 0, 0);
                    }
                }
                return originalToDataURL.apply(this, [type] as any);
            };

            // Randomize WebGL fingerprint
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
                if (parameter === 37445) {  // UNMASKED_VENDOR_WEBGL
                    return "Intel Inc.";
                }
                if (parameter === 37446) {  // UNMASKED_RENDERER_WEBGL
                    return "Intel Iris OpenGL Engine";
                }
                return getParameter.apply(this, [parameter]);
            };
        });

        // Set extra HTTP headers
        await page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
        });
    }

    getActiveCount(): number {
        let count = 0;
        for (const instance of this.browsers.values()) {
            count += instance.activeContexts;
        }
        return count;
    }

    async cleanup(): Promise<void> {
        logger.info("Cleaning up browser pool...");

        for (const instance of this.browsers.values()) {
            try {
                await instance.browser.close();
            } catch (err) {
                logger.error({ err }, "Error closing browser");
            }
        }

        this.browsers.clear();
        this.initialized = false;
    }
}
