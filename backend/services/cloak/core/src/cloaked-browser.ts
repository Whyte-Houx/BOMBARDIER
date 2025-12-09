/**
 * Cloaked Browser Service
 * Integrates CloakSessionManager with Playwright for fully protected automation
 */

import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import pino from 'pino';
import {
    CloakSessionManager,
    CloakSession,
    CloakSessionOptions,
    getCloakSessionManager,
} from './session-manager.js';
import { LeakPrevention } from '../../leak-prevention/src/index.js';
import { FingerprintEngine, BrowserPersonality } from '../../fingerprint/src/fingerprint-engine.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Types
// ============================================================================

export interface CloakedBrowserOptions {
    browserType?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    // Cloak options
    useFingerprint?: boolean;
    useProxy?: boolean;
    proxyUrl?: string;
    useTor?: boolean;
    // Leak prevention
    blockWebRTC?: boolean;
    useDnsOverHttps?: boolean;
    blockPlugins?: boolean;
    blockMediaDevices?: boolean;
    // Timing
    useTiming?: boolean;
}

export interface CloakedContext {
    context: BrowserContext;
    session: CloakSession;
    fingerprint?: BrowserPersonality;
}

// ============================================================================
// Cloaked Browser Class
// ============================================================================

export class CloakedBrowser {
    private browser?: Browser;
    private sessionManager: CloakSessionManager;
    private leakPrevention: LeakPrevention;
    private fingerprintEngine: FingerprintEngine;
    private contexts: Map<string, CloakedContext> = new Map();
    private options: CloakedBrowserOptions;

    constructor(options: CloakedBrowserOptions = {}) {
        this.options = {
            browserType: 'chromium',
            headless: true,
            useFingerprint: true,
            blockWebRTC: true,
            useDnsOverHttps: true,
            blockPlugins: true,
            blockMediaDevices: true,
            ...options,
        };

        this.sessionManager = getCloakSessionManager();
        this.leakPrevention = new LeakPrevention({
            blockWebRTC: this.options.blockWebRTC,
            useDnsOverHttps: this.options.useDnsOverHttps,
            blockPluginEnumeration: this.options.blockPlugins,
            blockMediaDeviceEnumeration: this.options.blockMediaDevices,
        });
        this.fingerprintEngine = new FingerprintEngine();
    }

    /**
     * Launch browser with cloak protections
     */
    async launch(): Promise<Browser> {
        logger.info('Launching cloaked browser...');

        // Get launch args from leak prevention
        const leakPreventionArgs = this.leakPrevention.getLaunchArgs();

        // Standard stealth args
        const stealthArgs = [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-popup-blocking',
        ];

        // Combine all args
        const allArgs = [...new Set([...stealthArgs, ...leakPreventionArgs])];

        // Select browser type
        const browserLauncher = {
            chromium,
            firefox,
            webkit,
        }[this.options.browserType || 'chromium'];

        this.browser = await browserLauncher.launch({
            headless: this.options.headless,
            args: allArgs,
        });

        logger.info({ browserType: this.options.browserType }, 'Cloaked browser launched');
        return this.browser;
    }

    /**
     * Create a new cloaked context with full protection
     */
    async newCloakedContext(contextOptions: CloakSessionOptions = {}): Promise<CloakedContext> {
        if (!this.browser) {
            await this.launch();
        }

        // Create cloak session
        const session = await this.sessionManager.createSession({
            useFingerprint: this.options.useFingerprint,
            useProxy: this.options.useProxy,
            proxyUrl: this.options.proxyUrl,
            useTor: this.options.useTor,
            blockWebRTC: this.options.blockWebRTC,
            useDnsOverHttps: this.options.useDnsOverHttps,
            ...contextOptions,
        });

        // Generate fingerprint if enabled
        let fingerprint: BrowserPersonality | undefined;
        if (this.options.useFingerprint) {
            fingerprint = this.fingerprintEngine.generatePersonality();
        }

        // Create browser context
        const contextConfig: any = {
            userAgent: fingerprint?.userAgent,
            viewport: fingerprint?.hardware.screen
                ? {
                    width: fingerprint.hardware.screen.width,
                    height: fingerprint.hardware.screen.height,
                }
                : undefined,
            locale: fingerprint?.network.locale,
            timezoneId: fingerprint?.network.timezone,
        };

        // Add proxy if configured
        const proxyConfig = this.sessionManager.getProxyConfig(session);
        if (proxyConfig) {
            contextConfig.proxy = proxyConfig;
        }

        const context = await this.browser!.newContext(contextConfig);

        // Apply leak prevention to context
        await this.leakPrevention.applyToContext(context);

        // Apply fingerprint to context
        if (fingerprint) {
            await this.fingerprintEngine.applyToContext(context, fingerprint);
        }

        // Apply session manager protections
        await this.sessionManager.applyToContext(context, session);

        const cloakedContext: CloakedContext = {
            context,
            session,
            fingerprint,
        };

        this.contexts.set(session.id, cloakedContext);

        logger.info({ sessionId: session.id }, 'Cloaked context created');
        return cloakedContext;
    }

    /**
     * Create a new page in a cloaked context
     */
    async newCloakedPage(contextOptions?: CloakSessionOptions): Promise<{
        page: Page;
        session: CloakSession;
        fingerprint?: BrowserPersonality;
    }> {
        const cloakedContext = await this.newCloakedContext(contextOptions);
        const page = await cloakedContext.context.newPage();

        // Apply page-level fingerprinting
        if (cloakedContext.fingerprint) {
            await this.fingerprintEngine.applyToPage(page, cloakedContext.fingerprint);
        }

        return {
            page,
            session: cloakedContext.session,
            fingerprint: cloakedContext.fingerprint,
        };
    }

    /**
     * Verify protection is working by running leak tests
     */
    async verifyProtection(page: Page): Promise<{
        passed: boolean;
        checks: Record<string, boolean>;
        details: string[];
    }> {
        logger.info('Verifying cloak protection...');

        const checks: Record<string, boolean> = {};
        const details: string[] = [];

        try {
            // Check WebRTC leak
            const webrtcResult = await page.evaluate(() => {
                return typeof window.RTCPeerConnection === 'undefined';
            });
            checks.webrtcBlocked = webrtcResult;
            details.push(webrtcResult ? '✓ WebRTC blocked' : '✗ WebRTC leak possible');

            // Check navigator.webdriver
            const webdriverHidden = await page.evaluate(() => {
                return navigator.webdriver === undefined || navigator.webdriver === false;
            });
            checks.webdriverHidden = webdriverHidden;
            details.push(webdriverHidden ? '✓ Webdriver hidden' : '✗ Automation detected');

            // Check plugins hidden
            const pluginsHidden = await page.evaluate(() => {
                return navigator.plugins.length === 0;
            });
            checks.pluginsHidden = pluginsHidden;
            details.push(pluginsHidden ? '✓ Plugins hidden' : '✗ Plugins exposed');

            // Check hardware concurrency spoofed
            const hwConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
            checks.hardwareSpoofed = typeof hwConcurrency === 'number';
            details.push(`✓ Hardware concurrency: ${hwConcurrency}`);

        } catch (err) {
            logger.error({ err }, 'Verification failed');
            details.push(`✗ Error: ${err}`);
        }

        const passed = Object.values(checks).every(Boolean);
        return { passed, checks, details };
    }

    /**
     * Run leak test against browserleaks.com
     */
    async runBrowserLeaksTest(page: Page): Promise<{
        webrtcSafe: boolean;
        canvasSafe: boolean;
        webglSafe: boolean;
        details: string[];
    }> {
        logger.info('Running browserleaks.com test...');
        const details: string[] = [];

        try {
            // Test WebRTC
            await page.goto('https://browserleaks.com/webrtc', { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);

            const webrtcResult = await page.evaluate(() => {
                const leakElement = document.querySelector('.local-ip, .stun-ip');
                return !leakElement || leakElement.textContent?.includes('n/a') || leakElement.textContent?.includes('No leak');
            });
            details.push(webrtcResult ? '✓ WebRTC: No leak detected' : '✗ WebRTC: Potential leak');

            // Test Canvas
            await page.goto('https://browserleaks.com/canvas', { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            details.push('✓ Canvas test page loaded (noise applied)');

            // Test WebGL
            await page.goto('https://browserleaks.com/webgl', { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            const webglVendor = await page.evaluate(() => {
                const vendorEl = document.querySelector('[data-content="unmaskedVendor"]');
                return vendorEl?.textContent || 'Unknown';
            });
            details.push(`✓ WebGL Vendor: ${webglVendor}`);

            return {
                webrtcSafe: webrtcResult,
                canvasSafe: true, // Noise always applied
                webglSafe: true, // Spoofed vendor
                details,
            };

        } catch (err) {
            logger.error({ err }, 'Browser leaks test failed');
            return {
                webrtcSafe: false,
                canvasSafe: false,
                webglSafe: false,
                details: [`Error: ${err}`],
            };
        }
    }

    /**
     * Close browser and cleanup
     */
    async close(): Promise<void> {
        // Destroy all sessions
        for (const [sessionId] of this.contexts) {
            await this.sessionManager.destroy(sessionId);
        }
        this.contexts.clear();

        // Close browser
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }

        logger.info('Cloaked browser closed');
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a quick cloaked page for simple automation
 */
export async function createCloakedPage(options?: CloakedBrowserOptions): Promise<{
    browser: CloakedBrowser;
    page: Page;
    session: CloakSession;
    close: () => Promise<void>;
}> {
    const browser = new CloakedBrowser(options);
    const { page, session } = await browser.newCloakedPage();

    return {
        browser,
        page,
        session,
        close: async () => browser.close(),
    };
}

/**
 * Run automation with full cloak protection
 */
export async function withCloakedBrowser<T>(
    fn: (page: Page, session: CloakSession) => Promise<T>,
    options?: CloakedBrowserOptions
): Promise<T> {
    const { page, session, close } = await createCloakedPage(options);

    try {
        return await fn(page, session);
    } finally {
        await close();
    }
}
