/**
 * Webhook Dispatcher Service
 * Handles sending webhook notifications with retry logic and HMAC signing
 */

import crypto from "crypto";
import { Webhook, IWebhook, WebhookEvent } from "../models/webhook.js";

// Simple logger with pino-like interface
const logger = {
    info: (obj: Record<string, unknown>, msg: string) => console.log(`[INFO] ${msg}`, JSON.stringify(obj)),
    error: (obj: Record<string, unknown>, msg: string) => console.error(`[ERROR] ${msg}`, JSON.stringify(obj)),
    warn: (obj: Record<string, unknown>, msg: string) => console.warn(`[WARN] ${msg}`, JSON.stringify(obj)),
};

interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    data: Record<string, any>;
}

interface DeliveryResult {
    webhookId: string;
    success: boolean;
    statusCode?: number;
    error?: string;
    retries: number;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function signPayload(payload: string, secret: string): string {
    return crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");
}

/**
 * Send a single webhook with retry logic
 */
async function sendWebhook(
    webhook: IWebhook,
    payload: WebhookPayload
): Promise<DeliveryResult> {
    const payloadString = JSON.stringify(payload);
    const signature = signPayload(payloadString, webhook.secret);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
        "X-Webhook-Id": webhook._id.toString(),
        "User-Agent": "Bombardier-Webhook/1.0",
    };

    // Add custom headers if configured
    if (webhook.headers) {
        const customHeaders = webhook.headers instanceof Map
            ? Object.fromEntries(webhook.headers)
            : webhook.headers;
        Object.assign(headers, customHeaders);
    }

    let lastError: string | undefined;
    let statusCode: number | undefined;
    let retries = 0;

    for (let attempt = 0; attempt <= webhook.retryPolicy.maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(webhook.url, {
                method: "POST",
                headers,
                body: payloadString,
                signal: controller.signal,
            });

            clearTimeout(timeout);
            statusCode = response.status;

            if (response.ok) {
                // Success - update stats
                await Webhook.updateOne(
                    { _id: webhook._id },
                    {
                        $inc: { "stats.totalSent": 1, "stats.totalSuccess": 1 },
                        $set: {
                            "stats.lastTriggeredAt": new Date(),
                            "stats.lastSuccessAt": new Date(),
                        },
                    }
                );

                logger.info({
                    webhookId: webhook._id,
                    event: payload.event,
                    statusCode,
                    retries,
                }, "Webhook delivered successfully");

                return {
                    webhookId: webhook._id.toString(),
                    success: true,
                    statusCode,
                    retries,
                };
            }

            // Non-2xx response - will retry if attempts remain
            lastError = `HTTP ${response.status}: ${response.statusText}`;
            retries = attempt;

            if (attempt < webhook.retryPolicy.maxRetries) {
                await sleep(webhook.retryPolicy.retryDelayMs * Math.pow(2, attempt)); // Exponential backoff
            }
        } catch (err: any) {
            lastError = err.message || "Unknown error";
            retries = attempt;

            if (attempt < webhook.retryPolicy.maxRetries) {
                await sleep(webhook.retryPolicy.retryDelayMs * Math.pow(2, attempt));
            }
        }
    }

    // All retries exhausted - update failure stats
    await Webhook.updateOne(
        { _id: webhook._id },
        {
            $inc: { "stats.totalSent": 1, "stats.totalFailed": 1 },
            $set: {
                "stats.lastTriggeredAt": new Date(),
                "stats.lastFailureAt": new Date(),
                "stats.lastError": lastError,
            },
        }
    );

    logger.error({
        webhookId: webhook._id,
        event: payload.event,
        error: lastError,
        retries,
    }, "Webhook delivery failed after retries");

    return {
        webhookId: webhook._id.toString(),
        success: false,
        statusCode,
        error: lastError,
        retries,
    };
}

/**
 * Dispatch webhooks for a given event
 * Finds all enabled webhooks subscribed to the event and sends them
 */
export async function dispatchWebhooks(
    event: WebhookEvent,
    data: Record<string, any>,
    userId?: string
): Promise<DeliveryResult[]> {
    const query: any = {
        events: event,
        enabled: true,
    };

    // If userId is provided, only send to that user's webhooks
    // Otherwise, this is a system event sent to all subscribers
    if (userId) {
        query.userId = userId;
    }

    const webhooks = await Webhook.find(query);

    if (webhooks.length === 0) {
        return [];
    }

    const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
    };

    // Send webhooks in parallel with a concurrency limit
    const results: DeliveryResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < webhooks.length; i += batchSize) {
        const batch = webhooks.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map((webhook) => sendWebhook(webhook, payload))
        );
        results.push(...batchResults);
    }

    return results;
}

/**
 * Test a webhook by sending a test payload
 */
export async function testWebhook(webhookId: string): Promise<DeliveryResult> {
    const webhook = await Webhook.findById(webhookId);

    if (!webhook) {
        return {
            webhookId,
            success: false,
            error: "Webhook not found",
            retries: 0,
        };
    }

    const testPayload: WebhookPayload = {
        event: "campaign.created", // Use a generic event for testing
        timestamp: new Date().toISOString(),
        data: {
            test: true,
            message: "This is a test webhook from Bombardier",
            webhookName: webhook.name,
        },
    };

    return sendWebhook(webhook, testPayload);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export event types for use in routes
export { WebhookEvent, WEBHOOK_EVENTS } from "../models/webhook.js";
