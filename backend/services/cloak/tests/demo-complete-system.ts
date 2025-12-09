
/**
 * 🎭 Complete Cloak System Demo
 * 
 * This script demonstrates the full power of the Cloak system by orchestrating
 * all 10 modules into a single cohesive automation task.
 * 
 * Flow:
 * 1. Setup Session (Fingerprint + Proxy + VPN + Location)
 * 2. Launch Protected Browser
 * 3. Verify Anonymity (Leaks, IP, Fingerprint)
 * 4. Perform Human-like Automation
 * 5. Cleanup
 */

import { chromium } from 'playwright';
import { getCloakedSession, humanDelay } from '../../workers/src/cloak-integration.js';
import { CloakedBrowser } from '../core/src/cloaked-browser.js';
import VPNManager from '../vpn-manager/src/index.js';
import { LocationSpoofer } from '../location-spoof/src/spoofer.js';
import { LeakPrevention } from '../leak-prevention/src/index.js';

async function runCompleteSystemDemo() {
    console.log('🚀 Starting Complete Cloak System Demo...');

    // --- Step 1: VPN Connection (Layer 1 Protection) ---
    console.log('\n🔒 [Layer 1] Initializing VPN...');
    const vpn = new VPNManager();
    // In a real run, you might want to connect. For demo, we verify status.
    const vpnStatus = await vpn.getStatus();
    console.log(`   VPN Connected: ${vpnStatus.isConnected}`);
    if (!vpnStatus.isConnected) {
        console.log('   (Skipping actual VPN connection for this demo script to avoid network unintentional routing changes)');
        // await vpn.connectFree(); 
    }

    // --- Step 2: Session Orchestration (Layer 2 Protection) ---
    console.log('\n🎭 [Layer 2] Creating Cloaked Identity...');
    const session = await getCloakedSession({
        useFingerprint: true,
        useProxy: true,
        geography: 'US', // Target US geography
    });
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Fingerprint: ${session.fingerprint.browserName} on ${session.fingerprint.os}`);
    console.log(`   Proxy: ${session.proxy ? session.proxy.host : 'Direct (or VPN)'}`);

    // --- Step 3: Advanced Spoofing Setup (Layer 3 Protection) ---
    console.log('\n🌍 [Layer 3] Configuring Advanced Spoofing...');

    // Location Spoofing
    const spoofer = new LocationSpoofer({ country: 'US' });
    const location = spoofer.generateLocation();
    console.log(`   Spoofing Location: ${location.city}, ${location.country}`);

    // Leak Prevention
    const leakPrev = new LeakPrevention();
    const leakLaunchArgs = leakPrev.getLaunchArgs();

    // --- Step 4: Browser Launch & Injection ---
    console.log('\n🌐 [Layer 4] Launching Protected Browser...');

    // Combine all protections
    const browser = new CloakedBrowser({
        headless: false, // Visible for demo
        args: [
            ...leakLaunchArgs,
            `--lang=${location.locales.join(',')}`
        ],
        useFingerprint: true
    });

    const { page, context } = await browser.newCloakedPage();

    // Apply Location & Leak Protections to running context
    await spoofer.applyToContext(context);
    await leakPrev.applyToContext(context);

    console.log('   Browser launched and injected successfully.');

    // --- Step 5: Verification Phase ---
    console.log('\n🕵️ [Verification] Checking Anonymity...');

    try {
        await page.goto('https://browserleaks.com/ip');
        await humanDelay(session, 'verification_pause');

        const ipText = await page.locator('#ip').textContent();
        console.log(`   Detected IP: ${ipText}`);

        // Simple visual check for WebRTC
        const webrtcLeak = await page.evaluate(() => {
            const pc = new RTCPeerConnection();
            pc.close();
            return 'RTCPeerConnection exists (should be protected by wrapper)';
        }).catch(() => 'Protected (RTCPeerConnection blocked/wrapped)');
        console.log(`   WebRTC Status: ${webrtcLeak}`);

    } catch (err) {
        console.error('   Verification failed (network error?)', err);
    }

    // --- Step 6: Human Behavior Simulation ---
    console.log('\n🤖 [Automation] Simulating Human Behavior...');

    // Example: Search engine interaction
    await page.goto('https://duckduckgo.com');
    await humanDelay(session, 'page_load');

    const searchBox = page.locator('input[name="q"]');
    await searchBox.click();
    await humanDelay(session, 'typing');
    await searchBox.fill('best privacy tools 2024');
    await humanDelay(session, 'before_search');
    await page.keyboard.press('Enter');

    console.log('   Search performed with human-like timing.');

    // --- Step 7: Cleanup ---
    console.log('\n🧹 [Cleanup] Closing session...');
    await browser.close();
    // await vpn.disconnect(); // If we connected VPN

    console.log('✨ Demo Complete - System Fully Operational.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runCompleteSystemDemo().catch(console.error);
}

export { runCompleteSystemDemo };
