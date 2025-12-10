/**
 * Webhook Model
 * Stores webhook configurations for external notifications
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IWebhook extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    url: string;
    secret: string;
    events: WebhookEvent[];
    headers?: Record<string, string>;
    enabled: boolean;
    retryPolicy: {
        maxRetries: number;
        retryDelayMs: number;
    };
    stats: {
        totalSent: number;
        totalSuccess: number;
        totalFailed: number;
        lastTriggeredAt?: Date;
        lastSuccessAt?: Date;
        lastFailureAt?: Date;
        lastError?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export type WebhookEvent =
    | "campaign.created"
    | "campaign.started"
    | "campaign.paused"
    | "campaign.completed"
    | "campaign.deleted"
    | "profile.approved"
    | "profile.rejected"
    | "profile.batch.approved"
    | "profile.batch.rejected"
    | "message.sent"
    | "message.delivered"
    | "message.failed"
    | "cloak.alert"
    | "system.error";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
    "campaign.created",
    "campaign.started",
    "campaign.paused",
    "campaign.completed",
    "campaign.deleted",
    "profile.approved",
    "profile.rejected",
    "profile.batch.approved",
    "profile.batch.rejected",
    "message.sent",
    "message.delivered",
    "message.failed",
    "cloak.alert",
    "system.error",
];

const WebhookSchema = new Schema<IWebhook>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        url: {
            type: String,
            required: true,
            validate: {
                validator: (v: string) => {
                    try {
                        const url = new URL(v);
                        return url.protocol === "https:" || url.protocol === "http:";
                    } catch {
                        return false;
                    }
                },
                message: "Invalid URL format",
            },
        },
        secret: {
            type: String,
            required: true,
        },
        events: {
            type: [String],
            enum: WEBHOOK_EVENTS,
            required: true,
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: "At least one event must be specified",
            },
        },
        headers: {
            type: Map,
            of: String,
            default: {},
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        retryPolicy: {
            maxRetries: { type: Number, default: 3, min: 0, max: 10 },
            retryDelayMs: { type: Number, default: 5000, min: 1000, max: 60000 },
        },
        stats: {
            totalSent: { type: Number, default: 0 },
            totalSuccess: { type: Number, default: 0 },
            totalFailed: { type: Number, default: 0 },
            lastTriggeredAt: Date,
            lastSuccessAt: Date,
            lastFailureAt: Date,
            lastError: String,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient querying
WebhookSchema.index({ userId: 1, enabled: 1 });
WebhookSchema.index({ events: 1, enabled: 1 });

export const Webhook = mongoose.model<IWebhook>("Webhook", WebhookSchema);
