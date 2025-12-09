# 🎭 Cloak System - Setup & Testing Guide

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Playwright** (will be installed)

---

## 📦 Installation

### Step 1: Install Dependencies in Each Module

Run these commands in the project root:

```bash
# Navigate to project
cd "/Volumes/Project Disk/Project Built/Z/Bombardier🔄/main_project_dir/app-bombardier-version"

# Install core module
cd backend/services/cloak/core && npm install && cd -

# Install leak-prevention module
cd backend/services/cloak/leak-prevention && npm install && cd -

# Install vpn-manager module  
cd backend/services/cloak/vpn-manager && npm install && cd -

# Install fingerprint module
cd backend/services/cloak/fingerprint && npm install && cd -

# Install proxy-scraper module (in cloak directory)
cd backend/services/cloak/proxy-scraper && npm install && cd -

# Install timing module
cd backend/services/cloak/timing && npm install && cd -

# Install account-warming module
cd backend/services/cloak/account-warming && npm install && cd -

# Install proxy-manager module
cd backend/services/cloak/proxy-manager && npm install && cd -
```

### Step 2: Install Playwright Browsers

```bash
npx playwright install chromium
```

---

## 🧪 Running the Leak Prevention Test

### Option 1: Quick Test Script

```bash
cd backend/services/cloak
npx tsx tests/test-cloak.ts
```

This will:

1. Launch a protected browser
2. Apply all cloak protections
3. Test against browserleaks.com
4. Generate screenshots in `/tmp/`
5. Display verification results

### Option 2: Manual Test

```typescript
// test-manual.ts
import { chromium } from 'playwright';
import { LeakPrevention } from './leak-prevention/src/index.js';
import { FingerprintEngine } from './fingerprint/src/fingerprint-engine.js';

async function test() {
    const leakPrevention = new LeakPrevention();
    const fingerprintEngine = new FingerprintEngine();
    
    // Get launch args
    const args = leakPrevention.getLaunchArgs();
    console.log('Launch args:', args);
    
    // Generate fingerprint
    const fingerprint = fingerprintEngine.generatePersonality();
    console.log('Fingerprint:', fingerprint.userAgent);
    
    // Launch browser
    const browser = await chromium.launch({
        headless: false,
        args,
    });
    
    const context = await browser.newContext({
        userAgent: fingerprint.userAgent,
    });
    
    // Apply protections
    await leakPrevention.applyToContext(context);
    await fingerprintEngine.applyToContext(context, fingerprint);
    
    const page = await context.newPage();
    await fingerprintEngine.applyToPage(page, fingerprint);
    
    // Test sites
    await page.goto('https://bot.sannysoft.com/');
    await page.waitForTimeout(5000);
    
    console.log('\nVerification:');
    
    // Check WebRTC
    const webrtcBlocked = await page.evaluate(() => {
        return typeof window.RTCPeerConnection === 'undefined';
    });
    console.log(`  WebRTC blocked: ${webrtcBlocked ? '✓' : '✗'}`);
    
    // Check webdriver
    const webdriverHidden = await page.evaluate(() => {
        return navigator.webdriver === undefined;
    });
    console.log(`  Webdriver hidden: ${webdriverHidden ? '✓' : '✗'}`);
    
    // Keep browser open
    console.log('\nBrowser open. Press Ctrl+C to exit.');
    await new Promise(() => {});
}

test().catch(console.error);
```

---

## 🌐 Testing Against Detection Sites

### Recommended Test Sites

1. **Bot Detection**
   - <https://bot.sannysoft.com/>
   - All rows should be ✓ green

2. **WebRTC Leak**
   - <https://browserleaks.com/webrtc>
   - Should show "No leak" or "n/a"

3. **Canvas Fingerprint**
   - <https://browserleaks.com/canvas>
   - Unique hash per session (noise applied)

4. **WebGL Fingerprint**
   - <https://browserleaks.com/webgl>
   - Spoofed vendor/renderer

5. **JavaScript**
   - <https://browserleaks.com/javascript>
   - Verify platform, languages match fingerprint

6. **CreepJS (Advanced)**
   - <https://abrahamjuliot.github.io/creepjs/>
   - Check trust score

---

## ✅ Expected Results

| Check | Expected |
|-------|----------|
| WebRTC | Blocked (no local IPs visible) |
| Webdriver | Hidden (undefined) |
| Plugins | Empty array |
| Canvas | Unique hash per session |
| WebGL Vendor | Spoofed value |
| Hardware Concurrency | Spoofed value |
| Platform | Matches selected fingerprint |
| Languages | Matches fingerprint |

---

## 🛠️ Using CloakedBrowser API

```typescript
import { CloakedBrowser, createCloakedPage, withCloakedBrowser } from '@bombardier/cloak-core';

// Method 1: Full control
const browser = new CloakedBrowser({
    browserType: 'chromium',
    headless: false,
    useFingerprint: true,
    blockWebRTC: true,
    useDnsOverHttps: true,
});

const { page, session } = await browser.newCloakedPage();
await page.goto('https://example.com');
const verification = await browser.verifyProtection(page);
console.log('Protected:', verification.passed);
await browser.close();

// Method 2: Simple one-liner
const result = await withCloakedBrowser(async (page, session) => {
    await page.goto('https://example.com');
    return await page.title();
});
console.log('Title:', result);
```

---

## 🐳 Docker Setup

If using Docker, all cloak services are already configured:

```bash
# Build all cloak services
docker-compose build cloak-proxy-manager cloak-fingerprint cloak-timing cloak-account-warming cloak-proxy-scraper cloak-vpn-manager

# Start services
docker-compose up -d cloak-proxy-manager cloak-fingerprint cloak-timing cloak-account-warming cloak-proxy-scraper
```

---

## 🔧 Troubleshooting

### "Cannot find module 'pino'"

```bash
cd backend/services/cloak/[module] && npm install
```

### "playwright: command not found"

```bash
npm install -g playwright
npx playwright install chromium
```

### WebRTC still leaking

- Ensure `blockWebRTC: true` in options
- Check Chrome args include `--disable-webrtc`
- Verify injection script is applied

### Canvas fingerprint not changing

- Check `canvasNoise` is > 0
- Verify `applyToPage()` is called

---

## 📊 Verification Checklist

- [ ] All modules installed (`npm install` in each)
- [ ] Playwright browsers installed
- [ ] Test script runs without errors
- [ ] bot.sannysoft.com shows all green
- [ ] browserleaks.com/webrtc shows no leak
- [ ] Canvas hash is unique per session
- [ ] WebGL vendor is spoofed
- [ ] Webdriver is hidden

---

## 🎉 Success

If all checks pass, your Cloak system is fully operational!

Use `CloakedBrowser` or `withCloakedBrowser()` for all automation to ensure protection.
