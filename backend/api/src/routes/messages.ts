import { FastifyPluginAsync } from "fastify";
import { MessageRepo } from "../repos.js";
import { trackingEvent } from "../lib/events.js";

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("messages.read")(request, reply);
    if (!permitted) return;
    const campaignId = (request.query as any).campaignId;
    if (!campaignId) { reply.code(400).send({ error: "MISSING_CAMPAIGN_ID" }); return; }
    const status = (request.query as any).status;
    const limit = Number((request.query as any).limit ?? 50);
    const skip = Number((request.query as any).skip ?? 0);
    const res = await MessageRepo.listByCampaign(campaignId, status, limit, skip);
    reply.send(res);
  });
  fastify.post("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("messages.write")(request, reply);
    if (!permitted) return;
    const created = await MessageRepo.create(request.body as any);
    trackingEvent("message.create", { campaignId: (request.body as any)?.campaignId, status: (request.body as any)?.status });
    reply.code(201).send(created);
  });
  fastify.post("/:id/status", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("messages.write")(request, reply);
    if (!permitted) return;
    const { status } = request.body as any;
    const updated = await MessageRepo.setStatus((request.params as any).id, status);
    trackingEvent("message.status", { campaignId: (updated as any)?.campaignId, status });
    reply.code(200).send(updated);
  });
};