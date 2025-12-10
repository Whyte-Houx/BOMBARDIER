/**
 * Webhook Routes
 * CRUD operations for webhook management + testing
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { Webhook, WEBHOOK_EVENTS, WebhookEvent } from "../models/webhook.js";
import { testWebhook } from "../services/webhook-dispatcher.js";

// Validation schemas
const WebhookCreateSchema = z.object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1),
    headers: z.record(z.string()).optional(),
    enabled: z.boolean().optional().default(true),
    retryPolicy: z
        .object({
            maxRetries: z.number().min(0).max(10).optional().default(3),
            retryDelayMs: z.number().min(1000).max(60000).optional().default(5000),
        })
        .optional(),
});

const WebhookUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1).optional(),
    headers: z.record(z.string()).optional(),
    enabled: z.boolean().optional(),
    retryPolicy: z
        .object({
            maxRetries: z.number().min(0).max(10).optional(),
            retryDelayMs: z.number().min(1000).max(60000).optional(),
        })
        .optional(),
});

export const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /webhooks
     * List all webhooks for the current user
     */
    fastify.get("/", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.read")(request, reply);
        if (!permitted) return;

        const userId = request.user?.id;
        const webhooks = await Webhook.find({ userId })
            .select("-secret")
            .sort({ createdAt: -1 });

        reply.send({
            success: true,
            data: webhooks,
        });
    });

    /**
     * GET /webhooks/:id
     * Get a single webhook by ID
     */
    fastify.get("/:id", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.read")(request, reply);
        if (!permitted) return;

        const { id } = request.params;
        const userId = request.user?.id;

        const webhook = await Webhook.findOne({ _id: id, userId }).select("-secret");

        if (!webhook) {
            return reply.code(404).send({
                success: false,
                error: "WEBHOOK_NOT_FOUND",
            });
        }

        reply.send({
            success: true,
            data: webhook,
        });
    });

    /**
     * POST /webhooks
     * Create a new webhook
     */
    fastify.post("/", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.write")(request, reply);
        if (!permitted) return;

        const parsed = WebhookCreateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({
                success: false,
                error: "VALIDATION_ERROR",
                details: parsed.error.issues,
            });
        }

        const userId = request.user?.id;

        // Check webhook limit (max 10 per user)
        const count = await Webhook.countDocuments({ userId });
        if (count >= 10) {
            return reply.code(400).send({
                success: false,
                error: "WEBHOOK_LIMIT_REACHED",
                message: "Maximum 10 webhooks allowed per user",
            });
        }

        // Generate a secure signing secret
        const secret = crypto.randomBytes(32).toString("hex");

        const webhook = await Webhook.create({
            userId,
            ...parsed.data,
            secret,
            retryPolicy: {
                maxRetries: parsed.data.retryPolicy?.maxRetries ?? 3,
                retryDelayMs: parsed.data.retryPolicy?.retryDelayMs ?? 5000,
            },
        });

        // Return webhook with secret (only shown once at creation)
        reply.code(201).send({
            success: true,
            data: {
                ...webhook.toObject(),
                secret, // Only returned on creation
            },
            message: "Webhook created. Save the secret - it won't be shown again.",
        });
    });

    /**
     * PATCH /webhooks/:id
     * Update webhook configuration
     */
    fastify.patch("/:id", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.write")(request, reply);
        if (!permitted) return;

        const { id } = request.params;
        const userId = request.user?.id;

        const parsed = WebhookUpdateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({
                success: false,
                error: "VALIDATION_ERROR",
                details: parsed.error.issues,
            });
        }

        const webhook = await Webhook.findOneAndUpdate(
            { _id: id, userId },
            { $set: parsed.data },
            { new: true }
        ).select("-secret");

        if (!webhook) {
            return reply.code(404).send({
                success: false,
                error: "WEBHOOK_NOT_FOUND",
            });
        }

        reply.send({
            success: true,
            data: webhook,
        });
    });

    /**
     * DELETE /webhooks/:id
     * Delete a webhook
     */
    fastify.delete("/:id", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.write")(request, reply);
        if (!permitted) return;

        const { id } = request.params;
        const userId = request.user?.id;

        const result = await Webhook.deleteOne({ _id: id, userId });

        if (result.deletedCount === 0) {
            return reply.code(404).send({
                success: false,
                error: "WEBHOOK_NOT_FOUND",
            });
        }

        reply.code(204).send();
    });

    /**
     * POST /webhooks/:id/test
     * Send a test event to the webhook
     */
    fastify.post("/:id/test", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.write")(request, reply);
        if (!permitted) return;

        const { id } = request.params;
        const userId = request.user?.id;

        // Verify ownership
        const webhook = await Webhook.findOne({ _id: id, userId });
        if (!webhook) {
            return reply.code(404).send({
                success: false,
                error: "WEBHOOK_NOT_FOUND",
            });
        }

        const result = await testWebhook(id);

        reply.send({
            success: result.success,
            data: result,
        });
    });

    /**
     * POST /webhooks/:id/regenerate-secret
     * Generate a new signing secret
     */
    fastify.post("/:id/regenerate-secret", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.write")(request, reply);
        if (!permitted) return;

        const { id } = request.params;
        const userId = request.user?.id;

        const newSecret = crypto.randomBytes(32).toString("hex");

        const webhook = await Webhook.findOneAndUpdate(
            { _id: id, userId },
            { $set: { secret: newSecret } },
            { new: true }
        );

        if (!webhook) {
            return reply.code(404).send({
                success: false,
                error: "WEBHOOK_NOT_FOUND",
            });
        }

        reply.send({
            success: true,
            data: {
                id: webhook._id,
                secret: newSecret,
            },
            message: "Secret regenerated. Save it - it won't be shown again.",
        });
    });

    /**
     * GET /webhooks/events
     * List available webhook event types
     */
    fastify.get("/events", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("webhooks.read")(request, reply);
        if (!permitted) return;

        reply.send({
            success: true,
            data: WEBHOOK_EVENTS.map((event) => ({
                event,
                description: getEventDescription(event),
            })),
        });
    });
};

function getEventDescription(event: WebhookEvent): string {
    const descriptions: Record<WebhookEvent, string> = {
        "campaign.created": "A new campaign was created",
        "campaign.started": "A campaign was started/activated",
        "campaign.paused": "A campaign was paused",
        "campaign.completed": "A campaign was marked as completed",
        "campaign.deleted": "A campaign was deleted",
        "profile.approved": "A single profile was approved",
        "profile.rejected": "A single profile was rejected",
        "profile.batch.approved": "Multiple profiles were approved in batch",
        "profile.batch.rejected": "Multiple profiles were rejected in batch",
        "message.sent": "A message was sent to a profile",
        "message.delivered": "A message was confirmed delivered",
        "message.failed": "A message delivery failed",
        "cloak.alert": "Anti-detection system raised an alert",
        "system.error": "A system error occurred",
    };
    return descriptions[event] || event;
}

export default webhooksRoutes;
