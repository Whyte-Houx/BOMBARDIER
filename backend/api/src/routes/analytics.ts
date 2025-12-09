import { FastifyPluginAsync } from "fastify";
import { AnalyticsRepo, CampaignStatusRepo } from "../repos.js";
import { AnalyticsQuerySchema } from "../dto.js";

/**
 * Analytics Routes
 * Per dev_docs/technical_specs/architecture.md - Analytics & Reporting
 */
export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
    // Get aggregated metrics
    fastify.get("/metrics", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
        if (!permitted) return;

        const campaignId = (request.query as any).campaignId;
        const startDate = (request.query as any).startDate ? new Date((request.query as any).startDate) : undefined;
        const endDate = (request.query as any).endDate ? new Date((request.query as any).endDate) : undefined;

        const metrics = await AnalyticsRepo.getMetrics({ campaignId, startDate, endDate });
        reply.send(metrics);
    });

    // Get campaign summary stats
    fastify.get("/summary/:campaignId", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
        if (!permitted) return;

        const campaignId = (request.params as any).campaignId;
        if (!campaignId) {
            reply.code(400).send({ error: "MISSING_CAMPAIGN_ID" });
            return;
        }

        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        const endDate = new Date();

        const [profiles, messages, aggregate, conversionRate] = await Promise.all([
            CampaignStatusRepo.countProfilesByStatus(campaignId),
            CampaignStatusRepo.countMessagesByStatus(campaignId),
            AnalyticsRepo.aggregate(campaignId, startDate, endDate),
            CampaignStatusRepo.getConversionRate(campaignId)
        ]);

        reply.send({
            campaignId,
            period: { startDate, endDate },
            profiles,
            messages,
            aggregate,
            conversionRate: Math.round(conversionRate * 100) / 100
        });
    });

    // Record an analytics event (internal use by workers)
    fastify.post("/event", async (request: any, reply: any) => {
        // No permission check - internal endpoint for workers
        const { type, campaignId, userId, platform, metrics } = request.body as any;

        if (!type) {
            reply.code(400).send({ error: "MISSING_TYPE" });
            return;
        }

        await AnalyticsRepo.recordEvent(type, { campaignId, userId, platform }, metrics || {});
        reply.code(201).send({ recorded: true });
    });

    // Record a metric (internal use by workers)
    fastify.post("/metric", async (request: any, reply: any) => {
        const { campaignId, userId, platform, metrics } = request.body as any;

        if (!metrics || typeof metrics !== "object") {
            reply.code(400).send({ error: "INVALID_METRICS" });
            return;
        }

        await AnalyticsRepo.recordMetric({ campaignId, userId, platform }, metrics);
        reply.code(201).send({ recorded: true });
    });

    // Get realtime stats (for dashboard)
    fastify.get("/realtime", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
        if (!permitted) return;

        // Get stats from last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const metrics = await AnalyticsRepo.getMetrics({ startDate: oneHourAgo });

        // Aggregate realtime counts
        let totalEvents = 0;
        let profilesProcessed = 0;
        let messagesSent = 0;
        let responsesReceived = 0;

        for (const m of metrics as any[]) {
            totalEvents++;
            profilesProcessed += m.metrics?.profilesProcessed || 0;
            messagesSent += m.metrics?.messagesSent || 0;
            responsesReceived += m.metrics?.responsesReceived || 0;
        }

        reply.send({
            period: "last_hour",
            totalEvents,
            profilesProcessed,
            messagesSent,
            responsesReceived,
            timestamp: new Date().toISOString()
        });
    });

    // Get pipeline health status
    fastify.get("/health", async (request: any, reply: any) => {
        const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
        if (!permitted) return;

        // This would check worker health in production
        // For now, return simulated status
        reply.send({
            status: "healthy",
            workers: {
                acquisition: { status: "running", lastHeartbeat: new Date().toISOString() },
                filtering: { status: "running", lastHeartbeat: new Date().toISOString() },
                research: { status: "running", lastHeartbeat: new Date().toISOString() },
                engagement: { status: "running", lastHeartbeat: new Date().toISOString() },
                tracking: { status: "running", lastHeartbeat: new Date().toISOString() }
            },
            queues: {
                acquisition: { pending: 0, processing: 0 },
                filtering: { pending: 0, processing: 0 },
                research: { pending: 0, processing: 0 },
                engagement: { pending: 0, processing: 0 },
                tracking: { pending: 0, processing: 0 }
            },
            timestamp: new Date().toISOString()
        });
    });
};
