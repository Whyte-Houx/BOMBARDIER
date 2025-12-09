/**
 * Integration Tests - Anti-Detection Services
 * Tests for proxy manager, fingerprint engine, timing engine, and account warming
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProxyManager } from '../../../backend/services/proxy-manager/src/proxy-manager';
import { FingerprintEngine } from '../../../backend/services/fingerprint-engine/src/fingerprint-engine';
import { HumanTimingEngine } from '../../../backend/services/timing-engine/src/timing-engine';
import { AccountWarmingManager } from '../../../backend/services/account-warming/src/account-warming';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('Anti-Detection Services Integration', () => {
    let redis: Redis;
    let proxyManager: ProxyManager;
    let fingerprintEngine: FingerprintEngine;
    let timingEngine: HumanTimingEngine;
    let warmingManager: AccountWarmingManager;

    beforeAll(async () => {
        redis = new Redis(REDIS_URL);
        await redis.flushdb(); // Clean test database

        proxyManager = new ProxyManager(REDIS_URL);
        fingerprintEngine = new FingerprintEngine();
        timingEngine = new HumanTimingEngine();
        warmingManager = new AccountWarmingManager(REDIS_URL);
    });

    afterAll(async () => {
        await proxyManager.cleanup();
        await warmingManager.cleanup();
        await redis.quit();
    });

    describe('Proxy Manager', () => {
        it('should initialize with proxy pools', async () => {
            await proxyManager.initialize({
                pools: [
                    {
                        type: 'residential',
                        geography: 'US',
                        rotationStrategy: 'performance-based',
                        proxies: [
                            {
                                id: 'test-proxy-1',
                                host: 'proxy1.test.com',
                                port: 8080,
                                type: 'residential',
                                geography: 'US',
                                status: 'active',
                                metadata: {
                                    successRate: 1.0,
                                    captchaRate: 0.0,
                                    avgResponseTime: 500,
                                    lastUsed: new Date(),
                                    totalRequests: 0,
                                    failedRequests: 0,
                                },
                            },
                        ],
                    },
                ],
            });

            const health = await proxyManager.getHealthReport();
            expect(health.totalProxies).toBe(1);
            expect(health.activeProxies).toBe(1);
        });

        it('should acquire and release proxies', async () => {
            const proxy = await proxyManager.acquireProxy({
                type: 'residential',
                geography: 'US',
            });

            expect(proxy).toBeDefined();
            expect(proxy.type).toBe('residential');
            expect(proxy.geography).toBe('US');

            await proxyManager.releaseProxy(proxy.id);
        });

        it('should maintain session persistence', async () => {
            const sessionId = 'test-session-123';

            const proxy1 = await proxyManager.acquireProxy({ sessionId });
            const proxy2 = await proxyManager.acquireProxy({ sessionId });

            expect(proxy1.id).toBe(proxy2.id);

            await proxyManager.releaseProxy(proxy1.id, sessionId);
        });

        it('should track proxy health', async () => {
            const proxy = await proxyManager.acquireProxy();

            await proxyManager.reportUsage(proxy.id, {
                requestCount: 10,
                successCount: 9,
                failureCount: 1,
                captchaCount: 0,
                avgResponseTime: 450,
            });

            const health = await proxyManager.getHealthReport();
            expect(health.avgSuccessRate).toBeGreaterThan(0.8);
        });
    });

    describe('Fingerprint Engine', () => {
        it('should generate coherent browser personality', () => {
            const personality = fingerprintEngine.generatePersonality();

            expect(personality.id).toBeDefined();
            expect(personality.hardware).toBeDefined();
            expect(personality.behavioral).toBeDefined();
            expect(personality.network).toBeDefined();
            expect(personality.userAgent).toBeDefined();
        });

        it('should generate consistent hardware fingerprints', () => {
            const personality = fingerprintEngine.generatePersonality();

            // Screen resolution should match platform
            expect(personality.hardware.screen.width).toBeGreaterThan(0);
            expect(personality.hardware.screen.height).toBeGreaterThan(0);

            // WebGL should have vendor and renderer
            expect(personality.hardware.webgl.vendor).toBeDefined();
            expect(personality.hardware.webgl.renderer).toBeDefined();

            // Canvas noise should be subtle
            expect(personality.hardware.canvas.noise).toBeGreaterThan(0);
            expect(personality.hardware.canvas.noise).toBeLessThan(0.01);
        });

        it('should generate coherent network identity', () => {
            const personality = fingerprintEngine.generatePersonality();

            // Timezone and locale should match
            expect(personality.network.timezone).toBeDefined();
            expect(personality.network.locale).toBeDefined();
            expect(personality.network.languages).toBeInstanceOf(Array);
            expect(personality.network.languages.length).toBeGreaterThan(0);
        });

        it('should generate behavioral profiles', () => {
            const personality = fingerprintEngine.generatePersonality();

            expect(personality.behavioral.mouse.movementStyle).toMatch(/smooth|jittery|precise/);
            expect(personality.behavioral.typing.wpm).toBeGreaterThan(0);
            expect(personality.behavioral.scrolling.style).toMatch(/smooth|stepped|fast/);
        });
    });

    describe('Timing Engine', () => {
        it('should calculate delays with Poisson distribution', () => {
            const context = {
                currentTime: new Date(),
                actionHistory: [],
                userProfile: {
                    timezone: 'America/New_York',
                    averageActionInterval: 5000,
                    activityPattern: 'morning' as const,
                    weekendBehavior: 'active' as const,
                },
                sessionStartTime: new Date(),
            };

            const delay = timingEngine.calculateNextActionDelay(context);

            expect(delay).toBeGreaterThan(0);
            expect(delay).toBeGreaterThanOrEqual(1000); // Minimum 1 second
        });

        it('should apply circadian rhythm modifiers', () => {
            const userProfile = {
                timezone: 'America/New_York',
                averageActionInterval: 5000,
                activityPattern: 'morning' as const,
                weekendBehavior: 'active' as const,
            };

            // Test sleep hours (3 AM)
            const sleepTime = new Date('2025-12-09T03:00:00');
            const isSleepTime = timingEngine.isGoodTimeForActivity(sleepTime, userProfile);
            expect(isSleepTime).toBe(false);

            // Test active hours (10 AM)
            const activeTime = new Date('2025-12-09T10:00:00');
            const isActiveTime = timingEngine.isGoodTimeForActivity(activeTime, userProfile);
            expect(isActiveTime).toBe(true);
        });

        it('should generate action clusters', () => {
            const delays = timingEngine.generateActionCluster(5, 3000);

            expect(delays).toBeInstanceOf(Array);
            expect(delays.length).toBeGreaterThanOrEqual(5);

            // First action should have normal delay
            expect(delays[0]).toBeGreaterThan(0);

            // Subsequent actions should be faster
            expect(delays[1]).toBeLessThan(delays[0]);
        });

        it('should generate realistic typing delays', () => {
            const text = 'Hello, how are you?';
            const delays = timingEngine.generateTypingDelays(text, 60, 0.02);

            expect(delays).toBeInstanceOf(Array);
            expect(delays.length).toBeGreaterThanOrEqual(text.length);

            // All delays should be positive
            delays.forEach((delay) => {
                expect(delay).toBeGreaterThan(0);
            });
        });
    });

    describe('Account Warming', () => {
        it('should register new accounts', async () => {
            const account = await warmingManager.registerAccount('twitter', 'test_user_1');

            expect(account.id).toBe('twitter:test_user_1');
            expect(account.status).toBe('new');
            expect(account.currentPhase).toBe('manual');
        });

        it('should enforce phase limits', async () => {
            const account = await warmingManager.registerAccount('twitter', 'test_user_2');

            // Should allow first message in light phase (after manual)
            const { allowed: allowed1 } = await warmingManager.canPerformAction(
                account.id,
                'browse',
                true
            );
            expect(allowed1).toBe(true);

            // Should not allow messages in manual phase
            const { allowed: allowed2, reason } = await warmingManager.canPerformAction(
                account.id,
                'message',
                true
            );
            expect(allowed2).toBe(false);
            expect(reason).toContain('not allowed');
        });

        it('should track activity', async () => {
            const account = await warmingManager.registerAccount('twitter', 'test_user_3');

            await warmingManager.recordAction(account.id, 'browse', true);
            await warmingManager.recordAction(account.id, 'like', true);

            const status = await warmingManager.getAccountStatus(account.id);
            expect(status?.todayActions).toBe(2);
        });

        it('should enforce automation levels', async () => {
            const account = await warmingManager.registerAccount('twitter', 'test_user_4');

            // Record many automated actions
            for (let i = 0; i < 10; i++) {
                await warmingManager.recordAction(account.id, 'browse', true);
            }

            // Should hit automation limit (0% in manual phase)
            const { allowed } = await warmingManager.canPerformAction(account.id, 'like', true);
            expect(allowed).toBe(false);
        });

        it('should advance phases over time', async () => {
            const account = await warmingManager.registerAccount('twitter', 'test_user_5');

            // Manually set phase start to 15 days ago
            account.phaseStartedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
            await warmingManager['saveAccount'](account);

            const advanced = await warmingManager.checkPhaseAdvancement(account.id);
            expect(advanced).toBe(true);

            const updatedStatus = await warmingManager.getAccountStatus(account.id);
            expect(updatedStatus?.account.currentPhase).toBe('light');
        });
    });

    describe('Integration: Combined Anti-Detection', () => {
        it('should work together for realistic automation', async () => {
            // 1. Acquire proxy
            const proxy = await proxyManager.acquireProxy({
                sessionId: 'integration-test-session',
                type: 'residential',
            });
            expect(proxy).toBeDefined();

            // 2. Generate fingerprint
            const personality = fingerprintEngine.generatePersonality();
            expect(personality).toBeDefined();

            // 3. Calculate timing
            const delay = timingEngine.calculateNextActionDelay({
                currentTime: new Date(),
                actionHistory: [],
                userProfile: {
                    timezone: personality.network.timezone,
                    averageActionInterval: 5000,
                    activityPattern: 'morning',
                    weekendBehavior: 'active',
                },
                sessionStartTime: new Date(),
            });
            expect(delay).toBeGreaterThan(0);

            // 4. Check account warming
            const account = await warmingManager.registerAccount('twitter', 'integration_test');
            const { allowed } = await warmingManager.canPerformAction(account.id, 'browse', true);
            expect(allowed).toBe(true);

            // Cleanup
            await proxyManager.releaseProxy(proxy.id, 'integration-test-session');
        });
    });
});
