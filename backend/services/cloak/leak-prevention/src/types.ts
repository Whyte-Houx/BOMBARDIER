/**
 * Leak Prevention Module - Types
 * Prevents WebRTC, DNS, IP, and other privacy leaks
 */

export interface LeakTestResult {
    passed: boolean;
    leaks: string[];
    ipLeak: boolean;
    dnsLeak: boolean;
    webrtcLeak: boolean;
    details: {
        realIp?: string;
        detectedIp?: string;
        dnsServers?: string[];
        webrtcIps?: string[];
    };
}

export interface LeakPreventionConfig {
    blockWebRTC: boolean;
    useDnsOverHttps: boolean;
    dnsProvider: 'cloudflare' | 'google' | 'quad9' | 'custom';
    customDnsUrl?: string;
    blockPluginEnumeration: boolean;
    blockMediaDeviceEnumeration: boolean;
    blockBatteryApi: boolean;
    killSwitchEnabled: boolean;
}

export const DEFAULT_LEAK_PREVENTION_CONFIG: LeakPreventionConfig = {
    blockWebRTC: true,
    useDnsOverHttps: true,
    dnsProvider: 'cloudflare',
    blockPluginEnumeration: true,
    blockMediaDeviceEnumeration: true,
    blockBatteryApi: true,
    killSwitchEnabled: false,
};
