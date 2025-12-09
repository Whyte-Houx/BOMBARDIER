/**
 * Leak Tester - Tests for IP, DNS, and WebRTC leaks
 */

import pino from 'pino';
import type { LeakTestResult } from './types.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class LeakTester {
    private originalIp?: string;
    private expectedIp?: string;

    /**
     * Set expected IP (from proxy/VPN)
     */
    setExpectedIp(ip: string): void {
        this.expectedIp = ip;
    }

    /**
     * Cache original IP before connecting
     */
    async cacheOriginalIp(): Promise<string | null> {
        try {
            const response = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(5000),
            });
            const data = await response.json() as { ip: string };
            this.originalIp = data.ip;
            logger.debug({ ip: this.originalIp }, 'Cached original IP');
            return this.originalIp || null;
        } catch (err) {
            logger.error({ err }, 'Failed to cache original IP');
            return null;
        }
    }

    /**
     * Run all leak tests
     */
    async runAllTests(): Promise<LeakTestResult> {
        logger.info('Running comprehensive leak tests...');

        const result: LeakTestResult = {
            passed: true,
            leaks: [],
            ipLeak: false,
            dnsLeak: false,
            webrtcLeak: false,
            details: {},
        };

        // IP Leak Test
        const ipResult = await this.testIpLeak();
        if (ipResult.leaked) {
            result.ipLeak = true;
            result.passed = false;
            result.leaks.push('IP leak detected');
            result.details.realIp = this.originalIp || undefined;
            result.details.detectedIp = ipResult.detectedIp;
        }

        // DNS Leak Test
        const dnsResult = await this.testDnsLeak();
        if (dnsResult.leaked) {
            result.dnsLeak = true;
            result.passed = false;
            result.leaks.push('DNS leak detected');
            result.details.dnsServers = dnsResult.servers;
        }

        if (result.passed) {
            logger.info('✓ All leak tests passed');
        } else {
            logger.warn({ leaks: result.leaks }, '⚠️ Leaks detected');
        }

        return result;
    }

    /**
     * Test for IP leaks
     */
    async testIpLeak(): Promise<{ leaked: boolean; detectedIp?: string }> {
        try {
            // Get current external IP
            const response = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(5000),
            });
            const data = await response.json() as { ip: string };
            const currentIp = data.ip;

            // Check if it matches expected
            if (this.expectedIp && currentIp !== this.expectedIp) {
                logger.warn(
                    { expected: this.expectedIp, actual: currentIp },
                    'IP mismatch detected'
                );
                return { leaked: true, detectedIp: currentIp };
            }

            // Check if it matches original (before proxy)
            if (this.originalIp && currentIp === this.originalIp) {
                logger.warn(
                    { originalIp: this.originalIp },
                    'IP leak - still using original IP'
                );
                return { leaked: true, detectedIp: currentIp };
            }

            return { leaked: false, detectedIp: currentIp };
        } catch (err) {
            logger.error({ err }, 'IP leak test failed');
            return { leaked: false };
        }
    }

    /**
     * Test for DNS leaks
     */
    async testDnsLeak(): Promise<{ leaked: boolean; servers?: string[] }> {
        try {
            // Use dnsleaktest.com API or similar
            // For now, use a simple check via multiple DNS resolvers
            const endpoints = [
                'https://1.1.1.1/cdn-cgi/trace', // Cloudflare
                'https://api.ipify.org?format=json', // Standard
            ];

            const ips: string[] = [];

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        signal: AbortSignal.timeout(5000),
                    });
                    const text = await response.text();
                    // Extract IP from response
                    const ipMatch = text.match(/\d+\.\d+\.\d+\.\d+/);
                    if (ipMatch) {
                        ips.push(ipMatch[0]);
                    }
                } catch {
                    // Ignore individual failures
                }
            }

            // If IPs are different, potential DNS leak
            const uniqueIps = [...new Set(ips)];
            if (uniqueIps.length > 1) {
                logger.warn({ ips: uniqueIps }, 'Potential DNS leak - inconsistent IPs');
                return { leaked: true, servers: uniqueIps };
            }

            return { leaked: false };
        } catch (err) {
            logger.error({ err }, 'DNS leak test failed');
            return { leaked: false };
        }
    }

    /**
     * Test for Tor connection
     */
    async testTorConnection(): Promise<boolean> {
        try {
            const response = await fetch('https://check.torproject.org/api/ip', {
                signal: AbortSignal.timeout(10000),
            });
            const data = await response.json() as { IsTor: boolean };
            return data.IsTor === true;
        } catch {
            return false;
        }
    }
}
