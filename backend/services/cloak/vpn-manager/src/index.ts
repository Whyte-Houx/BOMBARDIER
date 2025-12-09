/**
 * VPN Manager - Unified Interface
 * Supports WireGuard, OpenVPN, VPN Gate, and ProtonVPN
 */

import { WireGuardManager } from './wireguard.js';
import { OpenVPNManager } from './openvpn.js';
import { VPNGateProvider } from './providers/vpngate.js';
import { ProtonVPNProvider } from './providers/proton.js';
import type { VPNConfig, VPNStatus } from './types.js';

export { WireGuardManager } from './wireguard.js';
export { OpenVPNManager } from './openvpn.js';
export { VPNGateProvider } from './providers/vpngate.js';
export { ProtonVPNProvider } from './providers/proton.js';
export * from './types.js';

interface VPNManagerOptions {
    protonUsername?: string;
    protonPassword?: string;
    configDir?: string;
}

export class VPNManager {
    private wg: WireGuardManager;
    private ovpn: OpenVPNManager;
    private vpngate: VPNGateProvider;
    private proton: ProtonVPNProvider;
    private currentProtocol?: 'wireguard' | 'openvpn';

    constructor(options: VPNManagerOptions = {}) {
        this.wg = new WireGuardManager();
        this.ovpn = new OpenVPNManager(options.configDir || '/tmp/openvpn');
        this.vpngate = new VPNGateProvider();
        this.proton = new ProtonVPNProvider(options.protonUsername, options.protonPassword);
    }

    /**
     * Connect to best available free VPN
     */
    async connectFree(): Promise<boolean> {
        console.log('[VPNManager] Finding best free VPN...');

        try {
            // 1. Try ProtonVPN first (higher quality, requires credentials)
            const protonConfigs = await this.proton.fetchConfigs();
            if (protonConfigs.length > 0) {
                console.log(`[VPNManager] Found ${protonConfigs.length} ProtonVPN configs, trying...`);

                // Pick random to load balance
                const shuffled = [...protonConfigs].sort(() => Math.random() - 0.5);

                for (const config of shuffled.slice(0, 3)) {
                    console.log(`[VPNManager] Trying ${config.name}...`);
                    if (await this.ovpn.connect(config)) {
                        this.currentProtocol = 'openvpn';
                        return true;
                    }
                }
            }

            // 2. Fallback to VPN Gate (free, no credentials)
            console.log('[VPNManager] Trying VPN Gate...');
            const configs = await this.vpngate.fetchConfigs();

            if (configs.length === 0) {
                console.error('[VPNManager] No VPN configs available');
                return false;
            }

            // Sort by score (quality) and try top servers
            const bestConfigs = configs
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 5);

            for (const config of bestConfigs) {
                console.log(`[VPNManager] Trying ${config.name} (score: ${config.score})...`);

                if (await this.ovpn.connect(config)) {
                    this.currentProtocol = 'openvpn';
                    return true;
                }
            }

            console.error('[VPNManager] All VPN connection attempts failed');
            return false;

        } catch (err) {
            console.error('[VPNManager] Failed to connect to free VPN:', err);
            return false;
        }
    }

    /**
     * Connect to specific config
     */
    async connect(config: VPNConfig): Promise<boolean> {
        console.log(`[VPNManager] Connecting to ${config.name} via ${config.protocol}...`);

        try {
            if (config.protocol === 'wireguard') {
                const success = await this.wg.connect(config);
                if (success) this.currentProtocol = 'wireguard';
                return success;
            } else {
                const success = await this.ovpn.connect(config);
                if (success) this.currentProtocol = 'openvpn';
                return success;
            }
        } catch (err) {
            console.error('[VPNManager] Connection failed:', err);
            return false;
        }
    }

    /**
     * Disconnect current VPN
     */
    async disconnect(): Promise<void> {
        console.log('[VPNManager] Disconnecting...');

        if (this.currentProtocol === 'wireguard') {
            await this.wg.disconnect();
        } else if (this.currentProtocol === 'openvpn') {
            await this.ovpn.disconnect();
        }

        this.currentProtocol = undefined;
    }

    /**
     * Get current status
     */
    getStatus(): VPNStatus {
        if (this.currentProtocol === 'wireguard') {
            return this.wg.getStatus();
        } else if (this.currentProtocol === 'openvpn') {
            return this.ovpn.getStatus();
        }

        return { isConnected: false };
    }

    /**
     * Check if connected
     */
    get isConnected(): boolean {
        return this.getStatus().isConnected;
    }

    /**
     * Get available VPN configs from all providers
     */
    async getAvailableConfigs(): Promise<VPNConfig[]> {
        const configs: VPNConfig[] = [];

        try {
            const protonConfigs = await this.proton.fetchConfigs();
            configs.push(...protonConfigs);
        } catch (err) {
            console.warn('[VPNManager] Failed to fetch ProtonVPN configs:', err);
        }

        try {
            const vpngateConfigs = await this.vpngate.fetchConfigs();
            configs.push(...vpngateConfigs);
        } catch (err) {
            console.warn('[VPNManager] Failed to fetch VPN Gate configs:', err);
        }

        return configs;
    }
}

// Default export for convenience
export default VPNManager;
