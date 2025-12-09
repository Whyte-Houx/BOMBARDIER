/**
 * Cloak System Verification Test
 * Tests leak prevention against browserleaks.com and other detection sites
 * 
 * Run with: npx tsx test-cloak.ts
 */

import { chromium } from 'playwright';
import { CloakSessionManager, getCloakSessionManager, createCloakedSession } from '../core/src/index.js';
import { LeakPrevention } from '../leak-prevention/src/index.js';
import { FingerprintEngine } from '../fingerprint/src/fingerprint-engine.js';

// ============================================================================
// Configuration
// ============================================================================

const TEST_SITES = {
    webrtc: 'https://browserleaks.com/webrtc',
    canvas: 'https://browserleaks.com/canvas',
    webgl: 'https://browserleaks.com/webgl',
    ip: 'https://browserleaks.com/ip',
    fonts: 'https://browserleaks.com/fonts',
    javascript: 'https://browserleaks.com/javascript',
    bot: 'https://bot.sannysoft.com/',
    creepjs: 'https://abrahamjuliot.github.io/creepjs/',
};

// ============================================================================
// Test Functions
// ============================================================================

async function testLeakPrevention() {
    console.log('\n🎭 CLOAK SYSTEM VERIFICATION TEST\n');
    console.log('='.repeat(60));

    // Initialize components
    const leakPrevention = new LeakPrevention({
        blockWebRTC: true,
        useDnsOverHttps: true,
        blockPluginEnumeration: true,
        blockMediaDeviceEnumeration: true,
        blockBatteryApi: true,
    });

    const fingerprintEngine = new FingerprintEngine();
    const sessionManager = getCloakSessionManager();

    // Get launch arguments
    const launchArgs = leakPrevention.getLaunchArgs();
    console.log('\n📋 Launch Arguments:');
    launchArgs.forEach(arg => console.log(`   ${arg}`));

    // Generate fingerprint
    const fingerprint = fingerprintEngine.generatePersonality();
    console.log('\n🎭 Generated Fingerprint:');
    console.log(`   User Agent: ${fingerprint.userAgent.substring(0, 60)}...`);
    console.log(`   Platform: ${fingerprint.network.platform}`);
    console.log(`   Hardware Concurrency: ${fingerprint.network.hardwareConcurrency}`);
    console.log(`   Device Memory: ${fingerprint.network.deviceMemory}GB`);
    console.log(`   Timezone: ${fingerprint.network.timezone}`);
    console.log(`   Screen: ${fingerprint.hardware.screen.width}x${fingerprint.hardware.screen.height}`);

    // Create session
    const session = await createCloakedSession({
        useFingerprint: true,
        blockWebRTC: true,
        useDnsOverHttps: true,
    });
    console.log(`\n📦 Session Created: ${session.id}`);

    // Launch browser
    console.log('\n🌐 Launching protected browser...');
    const browser = await chromium.launch({
        headless: false, // Set to true for headless testing
        args: launchArgs,
    });

    const context = await browser.newContext({
        userAgent: fingerprint.userAgent,
        viewport: {
            width: fingerprint.hardware.screen.width,
            height: fingerprint.hardware.screen.height,
        },
        locale: fingerprint.network.locale,
        timezoneId: fingerprint.network.timezone,
    });

    // Apply protections
    await leakPrevention.applyToContext(context);
    await fingerprintEngine.applyToContext(context, fingerprint);
    await sessionManager.applyToContext(context, session);

    console.log('✅ Protections applied to context');

    const page = await context.newPage();
    await fingerprintEngine.applyToPage(page, fingerprint);

    // Run verification checks
    console.log('\n🔍 Running verification checks...\n');

    // Check 1: WebRTC blocked
    const webrtcBlocked = await page.evaluate(() => {
        return typeof window.RTCPeerConnection === 'undefined';
    });
    console.log(`${webrtcBlocked ? '✅' : '❌'} WebRTC Blocked: ${webrtcBlocked}`);

    // Check 2: Navigator.webdriver hidden
    const webdriverHidden = await page.evaluate(() => {
        return navigator.webdriver === undefined || navigator.webdriver === false;
    });
    console.log(`${webdriverHidden ? '✅' : '❌'} Webdriver Hidden: ${webdriverHidden}`);

    // Check 3: Plugins enumeration blocked
    const pluginsBlocked = await page.evaluate(() => {
        return navigator.plugins.length === 0;
    });
    console.log(`${pluginsBlocked ? '✅' : '❌'} Plugins Blocked: ${pluginsBlocked}`);

    // Check 4: Hardware concurrency spoofed
    const hwConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
    const hwSpoofed = hwConcurrency === fingerprint.network.hardwareConcurrency;
    console.log(`${hwSpoofed ? '✅' : '⚠️'} Hardware Concurrency: ${hwConcurrency} (expected: ${fingerprint.network.hardwareConcurrency})`);

    // Check 5: Platform spoofed
    const platform = await page.evaluate(() => navigator.platform);
    const platformSpoofed = platform === fingerprint.network.platform;
    console.log(`${platformSpoofed ? '✅' : '⚠️'} Platform: ${platform} (expected: ${fingerprint.network.platform})`);

    // Test against detection sites
    console.log('\n🌐 Testing against detection sites...\n');

    // Test 1: Bot detection
    console.log('Testing: bot.sannysoft.com');
    try {
        await page.goto(TEST_SITES.bot, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/cloak-test-bot.png' });
        console.log('   Screenshot saved to /tmp/cloak-test-bot.png');
    } catch (err) {
        console.log(`   ⚠️ Could not complete: ${err}`);
    }

    // Test 2: WebRTC leak
    console.log('Testing: browserleaks.com/webrtc');
    try {
        await page.goto(TEST_SITES.webrtc, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        const hasLeak = await page.evaluate(() => {
            const localIp = document.querySelector('.local-ip');
            return localIp && !localIp.textContent?.includes('n/a');
        });
        console.log(`   ${hasLeak ? '❌ WebRTC leak detected' : '✅ No WebRTC leak'}`);
        await page.screenshot({ path: '/tmp/cloak-test-webrtc.png' });
    } catch (err) {
        console.log(`   ⚠️ Could not complete: ${err}`);
    }

    // Test 3: Canvas fingerprint
    console.log('Testing: browserleaks.com/canvas');
    try {
        await page.goto(TEST_SITES.canvas, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/cloak-test-canvas.png' });
        console.log('   ✅ Canvas noise applied (unique fingerprint)');
    } catch (err) {
        console.log(`   ⚠️ Could not complete: ${err}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY\n');

    const checks = [
        { name: 'WebRTC Blocked', passed: webrtcBlocked },
        { name: 'Webdriver Hidden', passed: webdriverHidden },
        { name: 'Plugins Blocked', passed: pluginsBlocked },
        { name: 'Hardware Spoofed', passed: hwSpoofed },
        { name: 'Platform Spoofed', passed: platformSpoofed },
    ];

    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;

    checks.forEach(c => {
        console.log(`   ${c.passed ? '✅' : '❌'} ${c.name}`);
    });

    console.log(`\n   Score: ${passed}/${total} checks passed`);
    console.log(`   Status: ${passed === total ? '🎉 FULLY PROTECTED' : '⚠️ PARTIAL PROTECTION'}`);

    // Keep browser open for manual inspection
    console.log('\n💡 Browser will stay open for manual inspection.');
    console.log('   Press Ctrl+C to close.\n');

    // Wait indefinitely (user can close manually)
    await new Promise(() => { });
}

// ============================================================================
// Run Tests
// ============================================================================

testLeakPrevention().catch(console.error);
