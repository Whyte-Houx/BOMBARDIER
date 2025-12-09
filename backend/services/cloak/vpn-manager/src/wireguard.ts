/**
 * WireGuard Manager
 * Manages WireGuard interfaces and connections
 */

import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { VPNConfig, VPNStatus, WireGuardConfig } from './types.js';

export class WireGuardManager {
    private interfaceName = 'wg0';
    private configPath: string;
    private currentConfig?: VPNConfig;
    private isConnected = false;
    private connectedAt?: Date;

    constructor(configDir: string = '/etc/wireguard') {
        this.configPath = join(configDir, `${this.interfaceName}.conf`);
    }

    /**
     * Connect to a WireGuard VPN
     */
    async connect(config: VPNConfig): Promise<boolean> {
        if (config.protocol !== 'wireguard') {
            throw new Error('Invalid protocol for WireGuard manager');
        }

        console.log(`[WireGuard] Connecting to ${config.name}...`);

        try {
            // Disconnect existing if any
            if (this.isConnected) {
                await this.disconnect();
            }

            // Ensure directory exists
            await mkdir(dirname(this.configPath), { recursive: true });

            // Write config file
            await writeFile(this.configPath, config.configContent, { mode: 0o600 });

            // Bring up interface
            await this.exec('wg-quick', ['up', this.configPath]);

            this.isConnected = true;
            this.currentConfig = config;
            this.connectedAt = new Date();

            // Verify connection
            const isWorking = await this.verifyConnection();
            if (!isWorking) {
                console.warn('[WireGuard] Connection verification failed, disconnecting...');
                await this.disconnect();
                return false;
            }

            console.log('[WireGuard] Connected successfully');
            return true;

        } catch (err) {
            console.error('[WireGuard] Failed to connect:', err);
            try {
                await this.disconnect();
            } catch {
                // Ignore cleanup errors
            }
            return false;
        }
    }

    /**
     * Disconnect WireGuard
     */
    async disconnect(): Promise<void> {
        console.log('[WireGuard] Disconnecting...');

        try {
            await this.exec('wg-quick', ['down', this.configPath]);
        } catch (err) {
            // Ignore error if interface already down
            console.debug('[WireGuard] Error during disconnect (might be already down):', err);
        }

        try {
            await unlink(this.configPath);
        } catch {
            // Ignore if file doesn't exist
        }

        this.isConnected = false;
        this.currentConfig = undefined;
        this.connectedAt = undefined;
    }

    /**
     * Get status
     */
    getStatus(): VPNStatus {
        const uptime = this.connectedAt
            ? Math.floor((Date.now() - this.connectedAt.getTime()) / 1000)
            : undefined;

        return {
            isConnected: this.isConnected,
            currentConfig: this.currentConfig,
            interfaceName: this.interfaceName,
            uptime,
        };
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Parse WireGuard config file content
     */
    static parseConfig(content: string): WireGuardConfig {
        const lines = content.split('\n');
        let section = '';

        const config: WireGuardConfig = {
            privateKey: '',
            address: '',
            peers: [],
        };

        let currentPeer: WireGuardConfig['peers'][0] | null = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line || line.startsWith('#')) {
                continue;
            }

            if (line.startsWith('[')) {
                // Save current peer if exists
                if (currentPeer) {
                    config.peers.push(currentPeer);
                    currentPeer = null;
                }

                section = line.toLowerCase();

                if (section === '[peer]') {
                    currentPeer = {
                        publicKey: '',
                        endpoint: '',
                        allowedIPs: '',
                    };
                }
                continue;
            }

            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();
            const keyLower = key.trim().toLowerCase();

            if (section === '[interface]') {
                switch (keyLower) {
                    case 'privatekey':
                        config.privateKey = value;
                        break;
                    case 'address':
                        config.address = value;
                        break;
                    case 'dns':
                        config.dns = value;
                        break;
                }
            } else if (section === '[peer]' && currentPeer) {
                switch (keyLower) {
                    case 'publickey':
                        currentPeer.publicKey = value;
                        break;
                    case 'endpoint':
                        currentPeer.endpoint = value;
                        break;
                    case 'allowedips':
                        currentPeer.allowedIPs = value;
                        break;
                    case 'persistentkeepalive':
                        currentPeer.persistentKeepalive = parseInt(value);
                        break;
                }
            }
        }

        // Add final peer
        if (currentPeer) {
            config.peers.push(currentPeer);
        }

        return config;
    }

    /**
     * Generate WireGuard config file content from parsed config
     */
    static generateConfig(config: WireGuardConfig): string {
        let content = '[Interface]\n';
        content += `PrivateKey = ${config.privateKey}\n`;
        content += `Address = ${config.address}\n`;

        if (config.dns) {
            content += `DNS = ${config.dns}\n`;
        }

        for (const peer of config.peers) {
            content += '\n[Peer]\n';
            content += `PublicKey = ${peer.publicKey}\n`;
            content += `Endpoint = ${peer.endpoint}\n`;
            content += `AllowedIPs = ${peer.allowedIPs}\n`;

            if (peer.persistentKeepalive) {
                content += `PersistentKeepalive = ${peer.persistentKeepalive}\n`;
            }
        }

        return content;
    }

    private async verifyConnection(): Promise<boolean> {
        // Wait for handshake
        await new Promise(r => setTimeout(r, 2000));

        try {
            // Simple ping check
            await this.exec('ping', ['-c', '1', '-W', '3', '8.8.8.8']);
            return true;
        } catch {
            return false;
        }
    }

    private exec(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (d: Buffer) => {
                stdout += d.toString();
            });

            proc.stderr.on('data', (d: Buffer) => {
                stderr += d.toString();
            });

            proc.on('error', (err: Error) => {
                reject(new Error(`Failed to spawn ${command}: ${err.message}`));
            });

            proc.on('close', (code: number | null) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`${command} exited with code ${code}: ${stderr}`));
                }
            });
        });
    }
}
