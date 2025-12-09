import { FastifyPluginAsync } from "fastify";
import { CampaignRepo, CampaignStatusRepo, AnalyticsRepo } from "../repos.js";
import { CampaignStartSchema, CampaignUpdateSchema } from "../dto.js";
import { getKey, setWithTTL, enqueue } from "../lib/redis.js";
import { trackingEvent } from "../lib/events.js";

export const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  // List campaigns with optional filters
  fastify.get("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.read")(request, reply);
    if (!permitted) return;
    const status = (request.query as any).status;
    const limit = Number((request.query as any).limit ?? 50);
    const skip = Number((request.query as any).skip ?? 0);
    const userId = (request.user as any)?.id;
    const filters: any = {};
    if (status) filters.status = status;
    // Non-admin users only see their own campaigns
    if ((request.user as any)?.role !== "admin") filters.userId = userId;
    const campaigns = await CampaignRepo.list(filters, limit, skip);
    reply.code(200).send(campaigns);
  });

  // Create a new campaign
  fastify.post("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const parsed = CampaignStartSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
      return;
    }
    const userId = (request.user as any)?.id;
    const campaign = await CampaignRepo.create({ ...parsed.data, userId, status: "draft" });
    trackingEvent("campaign.created", { campaignId: String((campaign as any)._id), userId });
    reply.code(201).send(campaign);
  });

  // Get campaign by ID
  fastify.get("/:id", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.read")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    // Non-admin users can only view their own campaigns
    if ((request.user as any)?.role !== "admin" && String((campaign as any).userId) !== String((request.user as any)?.id)) {
      reply.code(403).send({ error: "FORBIDDEN" });
      return;
    }
    reply.code(200).send(campaign);
  });

  // Get campaign status (profile + message counts) with caching
  fastify.get("/:id/status", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.read")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    if (!id) { reply.code(400).send({ error: "MISSING_ID" }); return; }
    const cacheKey = `cache:campaignStatus:${id}`;
    const cached = await getKey(cacheKey);
    if (cached) { reply.code(200).send(JSON.parse(cached)); return; }
    const profiles = await CampaignStatusRepo.countProfilesByStatus(id);
    const messages = await CampaignStatusRepo.countMessagesByStatus(id);
    const conversionRate = await CampaignStatusRepo.getConversionRate(id);
    const payload = { profiles, messages, conversionRate };
    await setWithTTL(cacheKey, JSON.stringify(payload), 10);
    reply.code(200).send(payload);
  });

  // Update campaign
  fastify.patch("/:id", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const parsed = CampaignUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
      return;
    }
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    // Non-admin users can only update their own campaigns
    if ((request.user as any)?.role !== "admin" && String((campaign as any).userId) !== String((request.user as any)?.id)) {
      reply.code(403).send({ error: "FORBIDDEN" });
      return;
    }
    const updated = await CampaignRepo.update(id, parsed.data);
    trackingEvent("campaign.updated", { campaignId: id });
    reply.code(200).send(updated);
  });

  // Start/activate campaign - queues acquisition job
  fastify.post("/:id/start", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    if ((campaign as any).status !== "draft" && (campaign as any).status !== "paused") {
      reply.code(400).send({ error: "INVALID_STATUS", message: "Campaign must be in draft or paused state to start" });
      return;
    }
    await CampaignRepo.setStatus(id, "active");
    // Queue the acquisition job
    await enqueue("queue:acquisition", JSON.stringify({
      campaignId: id,
      platforms: (campaign as any).targetCriteria?.platforms || []
    }));
    trackingEvent("campaign.started", { campaignId: id });
    reply.code(200).send({ status: "active", message: "Campaign started, acquisition job queued" });
  });

  // Pause campaign
  fastify.post("/:id/pause", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    if ((campaign as any).status !== "active") {
      reply.code(400).send({ error: "INVALID_STATUS", message: "Campaign must be active to pause" });
      return;
    }
    await CampaignRepo.setStatus(id, "paused");
    trackingEvent("campaign.paused", { campaignId: id });
    reply.code(200).send({ status: "paused" });
  });

  // Complete campaign
  fastify.post("/:id/complete", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    await CampaignRepo.setStatus(id, "completed");
    trackingEvent("campaign.completed", { campaignId: id });
    reply.code(200).send({ status: "completed" });
  });

  // Delete campaign (admin only or owner)
  fastify.delete("/:id", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const campaign = await CampaignRepo.findById(id);
    if (!campaign) {
      reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND" });
      return;
    }
    // Non-admin users can only delete their own campaigns
    if ((request.user as any)?.role !== "admin" && String((campaign as any).userId) !== String((request.user as any)?.id)) {
      reply.code(403).send({ error: "FORBIDDEN" });
      return;
    }
    await CampaignRepo.delete(id);
    trackingEvent("campaign.deleted", { campaignId: id });
    reply.code(204).send();
  });

  // Get campaign analytics
  fastify.get("/:id/analytics", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const startDate = (request.query as any).startDate ? new Date((request.query as any).startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = (request.query as any).endDate ? new Date((request.query as any).endDate) : new Date();
    const metrics = await AnalyticsRepo.getMetrics({ campaignId: id, startDate, endDate });
    const aggregate = await AnalyticsRepo.aggregate(id, startDate, endDate);
    reply.code(200).send({ metrics, aggregate });
  });
};