/**
 * Browser Injection Scripts for Leak Prevention
 * Injects JavaScript to block WebRTC, plugins, etc.
 */

import type { LeakPreventionConfig } from './types.js';

export class LeakPreventionInjector {
    /**
     * Get complete injection script for leak prevention
     */
    getInjectionScript(config: LeakPreventionConfig): string {
        const scripts: string[] = [
            '// Leak Prevention Injection',
            '"use strict";',
            '(function() {',
        ];

        if (config.blockWebRTC) {
            scripts.push(this.getWebRTCBlockingScript());
        }

        if (config.blockPluginEnumeration) {
            scripts.push(this.getPluginEnumerationBlockScript());
        }

        if (config.blockMediaDeviceEnumeration) {
            scripts.push(this.getMediaDeviceBlockScript());
        }

        if (config.blockBatteryApi) {
            scripts.push(this.getBatteryBlockScript());
        }

        scripts.push(
            'console.log("[Cloak] Leak prevention active");',
            '})();'
        );

        return scripts.join('\n');
    }

    /**
     * Get Chrome launch args for leak prevention
     */
    getChromeArgs(config: LeakPreventionConfig): string[] {
        const args: string[] = [
            // Privacy and stealth
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-notifications',
            // Background networking
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-domain-reliability',
            '--disable-sync',
            '--metrics-recording-only',
        ];

        if (config.blockWebRTC) {
            args.push(
                '--disable-webrtc',
                '--disable-webrtc-encryption',
                '--disable-webrtc-hw-decoding',
                '--disable-webrtc-hw-encoding',
                // Force WebRTC to use specified ICE servers only
                '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
                '--enforce-webrtc-ip-permission-check'
            );
        }

        if (config.useDnsOverHttps) {
            const dnsUrls: Record<string, string> = {
                cloudflare: 'https://cloudflare-dns.com/dns-query',
                google: 'https://dns.google/dns-query',
                quad9: 'https://dns.quad9.net/dns-query',
            };
            const dnsUrl = config.customDnsUrl || dnsUrls[config.dnsProvider] || dnsUrls.cloudflare;
            args.push(
                '--enable-features=DnsOverHttps',
                `--dns-over-https-server=${dnsUrl}`
            );
        }

        if (config.blockMediaDeviceEnumeration) {
            args.push('--use-fake-device-for-media-stream');
        }

        return args;
    }

    // ============================================================================
    // Private Script Generators
    // ============================================================================

    private getWebRTCBlockingScript(): string {
        return `
            // WebRTC Leak Prevention
            // Block RTCPeerConnection completely
            if (window.RTCPeerConnection) {
                window.RTCPeerConnection = undefined;
            }
            if (window.webkitRTCPeerConnection) {
                window.webkitRTCPeerConnection = undefined;
            }
            if (window.mozRTCPeerConnection) {
                window.mozRTCPeerConnection = undefined;
            }
            
            // Block RTCDataChannel
            if (window.RTCDataChannel) {
                window.RTCDataChannel = undefined;
            }
            
            // Block mediaDevices.getUserMedia
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia = function() {
                    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
                };
            }
            
            // Block legacy getUserMedia
            if (navigator.getUserMedia) {
                navigator.getUserMedia = function(constraints, success, error) {
                    error(new DOMException('Permission denied', 'NotAllowedError'));
                };
            }
            
            // Block webkitGetUserMedia
            if (navigator.webkitGetUserMedia) {
                navigator.webkitGetUserMedia = function(constraints, success, error) {
                    error(new DOMException('Permission denied', 'NotAllowedError'));
                };
            }
            
            // Override RTCIceCandidate
            if (window.RTCIceCandidate) {
                window.RTCIceCandidate = function() {
                    throw new Error('RTCIceCandidate is blocked');
                };
            }
            
            // Override RTCSessionDescription
            if (window.RTCSessionDescription) {
                window.RTCSessionDescription = function() {
                    throw new Error('RTCSessionDescription is blocked');
                };
            }
        `;
    }

    private getPluginEnumerationBlockScript(): string {
        return `
            // Plugin Enumeration Blocking
            Object.defineProperty(navigator, 'plugins', {
                get: function() {
                    return {
                        length: 0,
                        item: function() { return null; },
                        namedItem: function() { return null; },
                        refresh: function() {},
                        [Symbol.iterator]: function* () {}
                    };
                }
            });
            
            Object.defineProperty(navigator, 'mimeTypes', {
                get: function() {
                    return {
                        length: 0,
                        item: function() { return null; },
                        namedItem: function() { return null; },
                        [Symbol.iterator]: function* () {}
                    };
                }
            });
        `;
    }

    private getMediaDeviceBlockScript(): string {
        return `
            // Media Device Enumeration Blocking
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                navigator.mediaDevices.enumerateDevices = async function() {
                    return [];
                };
            }
            
            // Block getDisplayMedia
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia = function() {
                    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
                };
            }
        `;
    }

    private getBatteryBlockScript(): string {
        return `
            // Battery Status API Blocking/Randomization
            if (navigator.getBattery) {
                const originalGetBattery = navigator.getBattery;
                navigator.getBattery = async function() {
                    // Return randomized battery info
                    return {
                        charging: Math.random() > 0.5,
                        chargingTime: Infinity,
                        dischargingTime: Infinity,
                        level: 0.5 + Math.random() * 0.5,
                        addEventListener: function() {},
                        removeEventListener: function() {},
                        dispatchEvent: function() { return true; }
                    };
                };
            }
            
            // Block modern Battery API
            if ('BatteryManager' in window) {
                delete window.BatteryManager;
            }
        `;
    }
}
