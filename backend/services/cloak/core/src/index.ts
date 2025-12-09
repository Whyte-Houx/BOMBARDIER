/**
 * Cloak Core - Main Entry Point
 * Unified API for all Cloak services
 */

export * from './session-manager.js';
export * from './cloaked-browser.js';

import {
    CloakSessionManager,
    CloakSession,
    CloakSessionOptions,
    getCloakSessionManager,
    createCloakedSession,
} from './session-manager.js';

import {
    CloakedBrowser,
    CloakedBrowserOptions,
    CloakedContext,
    createCloakedPage,
    withCloakedBrowser,
} from './cloaked-browser.js';

// Re-export for convenience
export {
    CloakSessionManager,
    getCloakSessionManager,
    createCloakedSession,
    CloakedBrowser,
    createCloakedPage,
    withCloakedBrowser,
};

export type { CloakSession, CloakSessionOptions, CloakedBrowserOptions, CloakedContext };

/**
 * Quick start example:
 * 
 * ```typescript
 * import { createCloakedSession, getCloakSessionManager } from '@bombardier/cloak-core';
 * import { chromium } from 'playwright';
 * 
 * async function main() {
 *     // Create a cloaked session
 *     const session = await createCloakedSession({
 *         useFingerprint: true,
 *         useTor: true,
 *         blockWebRTC: true,
 *     });
 * 
 *     // Get session manager for launch args
 *     const manager = getCloakSessionManager();
 *     const launchArgs = manager.getLaunchArgs(session);
 *     const proxyConfig = manager.getProxyConfig(session);
 * 
 *     // Launch browser with cloak settings
 *     const browser = await chromium.launch({
 *         args: launchArgs,
 *     });
 * 
 *     const context = await browser.newContext({
 *         proxy: proxyConfig,
 *     });
 * 
 *     // Apply runtime protections
 *     await manager.applyToContext(context, session);
 * 
 *     // Use the context
 *     const page = await context.newPage();
 *     await page.goto('https://example.com');
 * 
 *     // Verify protection
 *     const verification = await manager.verify(session.id);
 *     console.log('Protection verified:', verification.passed);
 * 
 *     // Cleanup
 *     await browser.close();
 *     await manager.destroy(session.id);
 * }
 * ```
 */
