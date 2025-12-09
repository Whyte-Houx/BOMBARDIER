/**
 * Tor Integration Module
 * Provides free anonymous proxying through the Tor network
 */

import { spawn, ChildProcess } from 'child_process';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TorConfig {
    socksPort: number;
    controlPort: number;
    dataDir: string;
    torExecutable: string;
    maxCircuitDirtiness: number; // seconds before new circuit
    autoRotate: boolean;
    rotateIntervalMinutes: number;
}

const DEFAULT_CONFIG: TorConfig = {
    socksPort: 9050,
    controlPort: 9051,
    dataDir: '/tmp/tor-bombardier',
    torExecutable: 'tor',
    maxCircuitDirtiness: 600, // 10 minutes
    autoRotate: true,
    rotateIntervalMinutes: 10,
};

export class TorManager {
    private config: TorConfig;
    private torProcess?: ChildProcess;
    private isConnected = false;
    private currentIp?: string;
    private rotateInterval?: NodeJS.Timeout;

    constructor(config: Partial<TorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start Tor service
     */
    async start(): Promise<boolean> {
        logger.info('Starting Tor service...');

        try {
            // Check if Tor is already running
            if (await this.isRunning()) {
                logger.info('Tor already running');
                this.isConnected = true;
                await this.verifyConnection();
                return true;
            }

            // Start Tor process
            const torArgs = [
                '--SocksPort', String(this.config.socksPort),
                '--ControlPort', String(this.config.controlPort),
                '--DataDirectory', this.config.dataDir,
                '--MaxCircuitDirtiness', String(this.config.maxCircuitDirtiness),
                '--ExitNodes', '{us},{de},{nl},{fr},{gb}', // Limit to trusted exit nodes
            ];

            this.torProcess = spawn(this.config.torExecutable, torArgs, {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            // Handle output
            this.torProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Bootstrapped 100%')) {
                    logger.info('Tor bootstrapped 100%');
                    this.isConnected = true;
                }
            });

            this.torProcess.stderr?.on('data', (data) => {
                logger.error({ error: data.toString() }, 'Tor error');
            });

            this.torProcess.on('close', (code) => {
                logger.info({ code }, 'Tor process exited');
                this.isConnected = false;
            });

            // Wait for bootstrap
            await this.waitForBootstrap();

            if (this.isConnected) {
                await this.verifyConnection();

                // Start auto-rotation if enabled
                if (this.config.autoRotate) {
                    this.startAutoRotation();
                }

                logger.info('Tor service started successfully');
                return true;
            }

            return false;
        } catch (err) {
            logger.error({ err }, 'Failed to start Tor');
            return false;
        }
    }

    /**
     * Stop Tor service
     */
    async stop(): Promise<void> {
        logger.info('Stopping Tor service...');

        if (this.rotateInterval) {
            clearInterval(this.rotateInterval);
        }

        if (this.torProcess) {
            this.torProcess.kill('SIGTERM');
            this.torProcess = undefined;
        }

        this.isConnected = false;
        logger.info('Tor service stopped');
    }

    /**
     * Rotate Tor circuit (get new IP)
     */
    async rotateCircuit(): Promise<boolean> {
        logger.info('Rotating Tor circuit...');

        try {
            // Send NEWNYM signal via control port
            const response = await this.sendControlCommand('SIGNAL NEWNYM');

            if (response.includes('250 OK')) {
                // Wait for new circuit
                await this.sleep(3000);

                // Verify new IP
                const oldIp = this.currentIp;
                await this.verifyConnection();

                if (this.currentIp !== oldIp) {
                    logger.info(
                        { oldIp, newIp: this.currentIp },
                        'Circuit rotated successfully'
                    );
                    return true;
                }
            }

            logger.warn('Circuit rotation may have failed');
            return false;
        } catch (err) {
            logger.error({ err }, 'Failed to rotate circuit');
            return false;
        }
    }

    /**
     * Get Tor proxy URL for use in requests
     */
    getProxyUrl(): string {
        return `socks5://127.0.0.1:${this.config.socksPort}`;
    }

    /**
     * Get proxy configuration for Playwright
     */
    getPlaywrightProxy(): { server: string } {
        return {
            server: `socks5://127.0.0.1:${this.config.socksPort}`,
        };
    }

    /**
     * Check if Tor is connected
     */
    isActive(): boolean {
        return this.isConnected;
    }

    /**
     * Get current exit IP
     */
    async getCurrentIp(): Promise<string | null> {
        await this.verifyConnection();
        return this.currentIp || null;
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private async isRunning(): Promise<boolean> {
        try {
            const response = await fetch('https://check.torproject.org/api/ip', {
                // @ts-ignore
                agent: await this.createSocksAgent(),
                timeout: 5000,
            });

            const data = await response.json();
            return data.IsTor === true;
        } catch {
            return false;
        }
    }

    private async waitForBootstrap(timeout = 60000): Promise<void> {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            if (this.isConnected) {
                return;
            }
            await this.sleep(1000);
        }

        throw new Error('Tor bootstrap timeout');
    }

    private async verifyConnection(): Promise<boolean> {
        try {
            const { SocksProxyAgent } = await import('socks-proxy-agent');
            const agent = new SocksProxyAgent(
                `socks5://127.0.0.1:${this.config.socksPort}`
            );

            const response = await fetch('https://check.torproject.org/api/ip', {
                // @ts-ignore
                agent,
            });

            const data = await response.json();

            if (data.IsTor) {
                this.currentIp = data.IP;
                this.isConnected = true;
                logger.debug({ ip: this.currentIp }, 'Tor connection verified');
                return true;
            }

            logger.warn('Not connected through Tor');
            return false;
        } catch (err) {
            logger.error({ err }, 'Failed to verify Tor connection');
            return false;
        }
    }

    private async createSocksAgent(): Promise<any> {
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        return new SocksProxyAgent(`socks5://127.0.0.1:${this.config.socksPort}`);
    }

    private async sendControlCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const net = require('net');
            const client = new net.Socket();

            client.connect(this.config.controlPort, '127.0.0.1', () => {
                client.write(`${command}\r\n`);
            });

            client.on('data', (data: Buffer) => {
                resolve(data.toString());
                client.destroy();
            });

            client.on('error', (err: Error) => {
                reject(err);
            });

            setTimeout(() => {
                client.destroy();
                reject(new Error('Control command timeout'));
            }, 5000);
        });
    }

    private startAutoRotation(): void {
        const intervalMs = this.config.rotateIntervalMinutes * 60 * 1000;

        this.rotateInterval = setInterval(async () => {
            await this.rotateCircuit();
        }, intervalMs);

        logger.info(
            { intervalMinutes: this.config.rotateIntervalMinutes },
            'Auto-rotation started'
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Convenience function to create and start Tor
 */
export async function createTorManager(
    config?: Partial<TorConfig>
): Promise<TorManager> {
    const manager = new TorManager(config);
    await manager.start();
    return manager;
}
