/**
 * Real-Time Notification Service
 * 
 * Provides WebSocket-based real-time notifications to connected clients.
 * Supports room-based subscriptions, user targeting, and broadcast.
 * 
 * @module services/realtime-notifier
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket, RawData } from 'ws';

// ============================================================================
// Types
// ============================================================================

export interface ConnectedClient {
    ws: WebSocket;
    userId: string;
    subscriptions: Set<string>;
    lastPing: number;
    metadata: {
        ip: string;
        userAgent: string;
        connectedAt: Date;
    };
}

export interface NotificationPayload {
    type: string;
    channel: string;
    data: Record<string, unknown>;
    timestamp: string;
    id: string;
}

export type NotificationChannel =
    | 'campaigns'
    | 'profiles'
    | 'messages'
    | 'workers'
    | 'cloak'
    | 'analytics'
    | 'system'
    | 'user';

export interface SubscriptionMessage {
    action: 'subscribe' | 'unsubscribe';
    channels: string[];
}

// ============================================================================
// Realtime Notification Service
// ============================================================================

class RealtimeNotifier {
    private clients: Map<string, ConnectedClient> = new Map();
    private channelSubscribers: Map<string, Set<string>> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private messageCounter = 0;

    constructor() {
        // Start heartbeat to clean up stale connections
        this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);
    }

    /**
     * Generate unique message ID
     */
    private generateId(): string {
        return `msg_${Date.now()}_${++this.messageCounter}`;
    }

    /**
     * Register a new WebSocket connection
     */
    registerClient(
        clientId: string,
        ws: WebSocket,
        userId: string,
        request: FastifyRequest
    ): void {
        const client: ConnectedClient = {
            ws,
            userId,
            subscriptions: new Set(),
            lastPing: Date.now(),
            metadata: {
                ip: request.ip,
                userAgent: request.headers['user-agent'] || 'unknown',
                connectedAt: new Date()
            }
        };

        this.clients.set(clientId, client);

        // Auto-subscribe to user-specific channel
        this.subscribe(clientId, `user:${userId}`);

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'connected',
            channel: 'system',
            data: {
                clientId,
                userId,
                message: 'Connected to Bombardier real-time notifications',
                availableChannels: [
                    'campaigns', 'profiles', 'messages', 'workers',
                    'cloak', 'analytics', 'system', `user:${userId}`
                ]
            },
            timestamp: new Date().toISOString(),
            id: this.generateId()
        });

        console.log(`[realtime] Client ${clientId} connected (user: ${userId})`);
    }

    /**
     * Unregister a client connection
     */
    unregisterClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove from all channel subscriptions
        for (const channel of client.subscriptions) {
            const subscribers = this.channelSubscribers.get(channel);
            if (subscribers) {
                subscribers.delete(clientId);
                if (subscribers.size === 0) {
                    this.channelSubscribers.delete(channel);
                }
            }
        }

        this.clients.delete(clientId);
        console.log(`[realtime] Client ${clientId} disconnected`);
    }

    /**
     * Subscribe a client to a channel
     */
    subscribe(clientId: string, channel: string): boolean {
        const client = this.clients.get(clientId);
        if (!client) return false;

        client.subscriptions.add(channel);

        if (!this.channelSubscribers.has(channel)) {
            this.channelSubscribers.set(channel, new Set());
        }
        this.channelSubscribers.get(channel)!.add(clientId);

        console.log(`[realtime] Client ${clientId} subscribed to ${channel}`);
        return true;
    }

    /**
     * Unsubscribe a client from a channel
     */
    unsubscribe(clientId: string, channel: string): boolean {
        const client = this.clients.get(clientId);
        if (!client) return false;

        client.subscriptions.delete(channel);

        const subscribers = this.channelSubscribers.get(channel);
        if (subscribers) {
            subscribers.delete(clientId);
            if (subscribers.size === 0) {
                this.channelSubscribers.delete(channel);
            }
        }

        console.log(`[realtime] Client ${clientId} unsubscribed from ${channel}`);
        return true;
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(clientId: string, message: RawData): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.lastPing = Date.now();

        try {
            const data = JSON.parse(message.toString()) as SubscriptionMessage;

            if (data.action === 'subscribe' && Array.isArray(data.channels)) {
                for (const channel of data.channels) {
                    this.subscribe(clientId, channel);
                }
                this.sendToClient(clientId, {
                    type: 'subscribed',
                    channel: 'system',
                    data: { channels: data.channels },
                    timestamp: new Date().toISOString(),
                    id: this.generateId()
                });
            } else if (data.action === 'unsubscribe' && Array.isArray(data.channels)) {
                for (const channel of data.channels) {
                    this.unsubscribe(clientId, channel);
                }
                this.sendToClient(clientId, {
                    type: 'unsubscribed',
                    channel: 'system',
                    data: { channels: data.channels },
                    timestamp: new Date().toISOString(),
                    id: this.generateId()
                });
            }
        } catch (err) {
            console.error(`[realtime] Failed to parse message from ${clientId}:`, err);
        }
    }

    /**
     * Send a notification to a specific client
     */
    sendToClient(clientId: string, payload: NotificationPayload): boolean {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            client.ws.send(JSON.stringify(payload));
            return true;
        } catch (err) {
            console.error(`[realtime] Failed to send to ${clientId}:`, err);
            return false;
        }
    }

    /**
     * Send a notification to a specific user (all their connections)
     */
    sendToUser(userId: string, type: string, data: Record<string, unknown>): number {
        let sent = 0;
        const payload: NotificationPayload = {
            type,
            channel: `user:${userId}`,
            data,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };

        for (const [clientId, client] of this.clients) {
            if (client.userId === userId) {
                if (this.sendToClient(clientId, payload)) {
                    sent++;
                }
            }
        }

        return sent;
    }

    /**
     * Broadcast to all subscribers of a channel
     */
    broadcast(channel: string, type: string, data: Record<string, unknown>): number {
        const subscribers = this.channelSubscribers.get(channel);
        if (!subscribers || subscribers.size === 0) {
            return 0;
        }

        const payload: NotificationPayload = {
            type,
            channel,
            data,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };

        let sent = 0;
        for (const clientId of subscribers) {
            if (this.sendToClient(clientId, payload)) {
                sent++;
            }
        }

        console.log(`[realtime] Broadcast ${type} to ${channel}: ${sent} clients`);
        return sent;
    }

    /**
     * Broadcast to all connected clients
     */
    broadcastAll(type: string, data: Record<string, unknown>): number {
        const payload: NotificationPayload = {
            type,
            channel: 'system',
            data,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };

        let sent = 0;
        for (const [clientId] of this.clients) {
            if (this.sendToClient(clientId, payload)) {
                sent++;
            }
        }

        console.log(`[realtime] Broadcast ${type} to all: ${sent} clients`);
        return sent;
    }

    /**
     * Heartbeat to clean up stale connections
     */
    private heartbeat(): void {
        const now = Date.now();
        const staleThreshold = 60000; // 1 minute

        for (const [clientId, client] of this.clients) {
            if (now - client.lastPing > staleThreshold) {
                if (client.ws.readyState === WebSocket.OPEN) {
                    // Send ping
                    try {
                        client.ws.ping();
                    } catch {
                        this.unregisterClient(clientId);
                    }
                } else {
                    this.unregisterClient(clientId);
                }
            }
        }
    }

    /**
     * Get statistics about connected clients
     */
    getStats(): {
        totalClients: number;
        clientsByUser: Record<string, number>;
        channelStats: Record<string, number>;
    } {
        const clientsByUser: Record<string, number> = {};
        const channelStats: Record<string, number> = {};

        for (const [, client] of this.clients) {
            clientsByUser[client.userId] = (clientsByUser[client.userId] || 0) + 1;
        }

        for (const [channel, subscribers] of this.channelSubscribers) {
            channelStats[channel] = subscribers.size;
        }

        return {
            totalClients: this.clients.size,
            clientsByUser,
            channelStats
        };
    }

    /**
     * Shutdown the service
     */
    shutdown(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Close all connections
        for (const [clientId, client] of this.clients) {
            try {
                client.ws.close(1001, 'Server shutting down');
            } catch { }
            this.unregisterClient(clientId);
        }
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const realtimeNotifier = new RealtimeNotifier();

// ============================================================================
// Convenience Functions for Broadcasting Events
// ============================================================================

/**
 * Notify when a campaign status changes
 */
export function notifyCampaignUpdate(
    campaignId: string,
    status: string,
    userId: string,
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('campaigns', 'campaign.updated', {
        campaignId,
        status,
        userId,
        ...details
    });

    realtimeNotifier.sendToUser(userId, 'campaign.updated', {
        campaignId,
        status,
        ...details
    });
}

/**
 * Notify when a profile is processed
 */
export function notifyProfileEvent(
    event: 'discovered' | 'analyzed' | 'approved' | 'rejected' | 'engaged',
    profileId: string,
    campaignId: string,
    userId: string,
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('profiles', `profile.${event}`, {
        profileId,
        campaignId,
        userId,
        ...details
    });
}

/**
 * Notify when a message is sent/delivered/failed
 */
export function notifyMessageEvent(
    event: 'sent' | 'delivered' | 'failed' | 'replied',
    messageId: string,
    profileId: string,
    campaignId: string,
    userId: string,
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('messages', `message.${event}`, {
        messageId,
        profileId,
        campaignId,
        userId,
        ...details
    });

    realtimeNotifier.sendToUser(userId, `message.${event}`, {
        messageId,
        profileId,
        campaignId,
        ...details
    });
}

/**
 * Notify worker status changes
 */
export function notifyWorkerStatus(
    workerName: string,
    status: 'started' | 'stopped' | 'error' | 'processing',
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('workers', `worker.${status}`, {
        worker: workerName,
        ...details
    });
}

/**
 * Notify cloak system events
 */
export function notifyCloakEvent(
    event: 'connected' | 'disconnected' | 'leak_detected' | 'ip_changed',
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('cloak', `cloak.${event}`, {
        ...details
    });
}

/**
 * Notify analytics updates
 */
export function notifyAnalyticsUpdate(
    metricType: string,
    campaignId: string,
    value: number,
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcast('analytics', 'analytics.update', {
        metricType,
        campaignId,
        value,
        ...details
    });
}

/**
 * System-wide alert
 */
export function notifySystemAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    message: string,
    details?: Record<string, unknown>
): void {
    realtimeNotifier.broadcastAll(`system.${level}`, {
        message,
        level,
        ...details
    });
}

// ============================================================================
// Fastify Route Handler
// ============================================================================

export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
    // WebSocket endpoint for real-time notifications
    app.get('/ws', { websocket: true }, (socket, request) => {
        const user = (request as any).user;
        const userId = user?.id || 'anonymous';
        const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Fastify's websocket gives us a SocketStream, we need the actual WebSocket
        const ws = socket as unknown as WebSocket;

        realtimeNotifier.registerClient(clientId, ws, userId, request);

        socket.on('message', (message: RawData) => {
            realtimeNotifier.handleMessage(clientId, message);
        });

        socket.on('close', () => {
            realtimeNotifier.unregisterClient(clientId);
        });

        socket.on('error', (err: Error) => {
            console.error(`[realtime] WebSocket error for ${clientId}:`, err);
            realtimeNotifier.unregisterClient(clientId);
        });

        socket.on('pong', () => {
            const client = (realtimeNotifier as any).clients.get(clientId);
            if (client) {
                client.lastPing = Date.now();
            }
        });
    });

    // REST endpoint to get realtime stats
    app.get('/stats', async (request, reply) => {
        const user = (request as any).user;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Admin access required' });
        }

        return realtimeNotifier.getStats();
    });

    // REST endpoint to broadcast (admin only)
    app.post<{
        Body: { channel: string; type: string; data: Record<string, unknown> }
    }>('/broadcast', async (request, reply) => {
        const user = (request as any).user;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Admin access required' });
        }

        const { channel, type, data } = request.body;
        const sent = realtimeNotifier.broadcast(channel, type, data);

        return { success: true, sent };
    });
}
