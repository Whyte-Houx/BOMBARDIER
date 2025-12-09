/**
 * Leak Prevention Module - Main Entry Point
 */

import { BrowserContext, Page } from 'playwright';
import pino from 'pino';
import { LeakTester } from './leak-tester.js';
import { LeakPreventionInjector } from './injection.js';
import type { LeakPreventionConfig, LeakTestResult } from './types.js';

export * from './types.js';
export { LeakTester } from './leak-tester.js';
export { LeakPreventionInjector } from './injection.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class LeakPrevention {
    private config: LeakPreventionConfig;
    private tester: LeakTester;
    private injector: LeakPreventionInjector;

    constructor(config: Partial<LeakPreventionConfig> = {}) {
        this.config = {
            blockWebRTC: config.blockWebRTC ?? true,
            useDnsOverHttps: config.useDnsOverHttps ?? true,
            dnsProvider: config.dnsProvider ?? 'cloudflare',
            customDnsUrl: config.customDnsUrl,
            blockPluginEnumeration: config.blockPluginEnumeration ?? true,
            blockMediaDeviceEnumeration: config.blockMediaDeviceEnumeration ?? true,
            blockBatteryApi: config.blockBatteryApi ?? true,
            killSwitchEnabled: config.killSwitchEnabled ?? false,
        };

        this.tester = new LeakTester();
        this.injector = new LeakPreventionInjector();
    }

    /**
     * Get Chrome launch arguments for leak prevention
     */
    getLaunchArgs(): string[] {
        return this.injector.getChromeArgs(this.config);
    }

    /**
     * Get injection script for runtime protection
     */
    getInjectionScript(): string {
        return this.injector.getInjectionScript(this.config);
    }

    /**
     * Apply leak prevention to browser context
     */
    async applyToContext(context: BrowserContext): Promise<void> {
        const script = this.getInjectionScript();
        await context.addInitScript(script);
        logger.debug('Leak prevention applied to context');
    }

    /**
     * Apply leak prevention to page
     */
    async applyToPage(page: Page): Promise<void> {
        const script = this.getInjectionScript();
        await page.addInitScript(script);
        logger.debug('Leak prevention applied to page');
    }

    /**
     * Cache original IP before connecting to proxy/VPN
     */
    async cacheOriginalIp(): Promise<string | null> {
        return this.tester.cacheOriginalIp();
    }

    /**
     * Set expected IP after connecting to proxy/VPN
     */
    setExpectedIp(ip: string): void {
        this.tester.setExpectedIp(ip);
    }

    /**
     * Run all leak tests
     */
    async runLeakTests(): Promise<LeakTestResult> {
        return this.tester.runAllTests();
    }

    /**
     * Verify no leaks (convenience method)
     */
    async verifyNoLeaks(): Promise<boolean> {
        const result = await this.runLeakTests();
        return result.passed;
    }

    /**
     * Test if connected through Tor
     */
    async isUsingTor(): Promise<boolean> {
        return this.tester.testTorConnection();
    }

    /**
     * Get current configuration
     */
    getConfig(): LeakPreventionConfig {
        return { ...this.config };
    }
}

/**
 * Convenience function to create and configure LeakPrevention
 */
export function createLeakPrevention(
    config?: Partial<LeakPreventionConfig>
): LeakPrevention {
    return new LeakPrevention(config);
}
