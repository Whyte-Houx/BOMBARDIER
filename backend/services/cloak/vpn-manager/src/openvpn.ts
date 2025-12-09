/**
 * OpenVPN Manager
 * Manages OpenVPN connections
 */

import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { VPNConfig, VPNStatus } from './types.js';

export class OpenVPNManager {
    private process?: ChildProcess;
    private configPath: string;
    private authPath: string;
    private currentConfig?: VPNConfig;
    private isConnected = false;
    private connectedAt?: Date;

    constructor(private configDir: string = '/tmp/openvpn') {
        this.configPath = join(configDir, 'client.ovpn');
        this.authPath = join(configDir, 'auth.txt');
    }

    /**
     * Connect to OpenVPN
     */
    async connect(config: VPNConfig): Promise<boolean> {
        if (config.protocol !== 'openvpn') {
            throw new Error('Invalid protocol for OpenVPN manager');
        }

        console.log(`[OpenVPN] Connecting to ${config.name}...`);

        if (this.isConnected) {
            await this.disconnect();
        }

        try {
            // Ensure config directory exists
            await mkdir(dirname(this.configPath), { recursive: true });

            // Write config
            await writeFile(this.configPath, config.configContent, { mode: 0o600 });

            // Build args
            const args = ['--config', this.configPath, '--daemon', '--log', '/tmp/openvpn/openvpn.log'];

            // Write auth if needed
            if (config.username && config.password) {
                await writeFile(this.authPath, `${config.username}\n${config.password}`, { mode: 0o600 });
                args.push('--auth-user-pass', this.authPath);
            }

            // Start OpenVPN
            this.process = spawn('openvpn', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
            });

            // Monitor startup
            return new Promise((resolve) => {
                let resolved = false;
                let stdout = '';
                let stderr = '';

                const timeout = setTimeout(() => {
                    if (!resolved) {
                        console.error('[OpenVPN] Connection timeout');
                        this.disconnect();
                        resolved = true;
                        resolve(false);
                    }
                }, 30000); // 30 second timeout

                this.process?.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString();
                    stdout += output;

                    if (output.includes('Initialization Sequence Completed')) {
                        console.log('[OpenVPN] Connected successfully');
                        this.isConnected = true;
                        this.currentConfig = config;
                        this.connectedAt = new Date();
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(true);
                    }
                });

                this.process?.stderr?.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });

                this.process?.on('close', (code: number | null) => {
                    if (!resolved) {
                        console.error(`[OpenVPN] Process exited with code ${code}`);
                        if (stderr) console.error(`[OpenVPN] stderr: ${stderr}`);
                        resolved = true;
                        resolve(false);
                    }
                    this.isConnected = false;
                    this.process = undefined;
                });

                this.process?.on('error', (err: Error) => {
                    if (!resolved) {
                        console.error('[OpenVPN] Spawn error:', err.message);
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(false);
                    }
                });
            });

        } catch (err) {
            console.error('[OpenVPN] Failed to start:', err);
            await this.disconnect();
            return false;
        }
    }

    /**
     * Disconnect OpenVPN
     */
    async disconnect(): Promise<void> {
        console.log('[OpenVPN] Disconnecting...');

        if (this.process) {
            this.process.kill('SIGTERM');

            // Wait for process to exit
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    if (this.process) {
                        this.process.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.process?.on('close', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.process = undefined;
        }

        this.isConnected = false;
        this.currentConfig = undefined;
        this.connectedAt = undefined;

        // Cleanup files
        try {
            await unlink(this.configPath);
        } catch {
            // Ignore if file doesn't exist
        }

        try {
            await unlink(this.authPath);
        } catch {
            // Ignore if file doesn't exist
        }
    }

    /**
     * Get connection status
     */
    getStatus(): VPNStatus {
        const uptime = this.connectedAt
            ? Math.floor((Date.now() - this.connectedAt.getTime()) / 1000)
            : undefined;

        return {
            isConnected: this.isConnected,
            currentConfig: this.currentConfig,
            uptime,
        };
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.isConnected;
    }
}
