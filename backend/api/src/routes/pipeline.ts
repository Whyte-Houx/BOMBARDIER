import { FastifyPluginAsync } from "fastify";
import { CampaignStartSchema } from "../dto.js";
import { Campaign, Profile } from "../lib/mongo.js";
import { enqueue } from "../lib/redis.js";

export const pipelineRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/run", async (request, reply) => {
    const permitted = await (fastify as any).requirePermission("campaigns.write")(request, reply);
    if (!permitted) return;
    const parsed = CampaignStartSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "BAD_REQUEST" });
      return;
    }
    const doc = await Campaign.create({
      name: parsed.data.name,
      targetCriteria: parsed.data.targetCriteria,
      status: "active"
    });
    await enqueue("queue:acquisition", JSON.stringify({ campaignId: String(doc._id), platforms: parsed.data.targetCriteria.platforms || [] }));
    reply.code(202).send({ campaignId: String(doc._id) });
  });
};