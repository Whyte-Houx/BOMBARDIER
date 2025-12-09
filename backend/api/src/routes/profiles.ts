import { FastifyPluginAsync } from "fastify";
import { ProfileRepo } from "../repos.js";
import { trackingEvent } from "../lib/events.js";
import { ProfileCreateSchema } from "../dto.js";

export const profilesRoutes: FastifyPluginAsync = async (fastify) => {
  // List profiles with filters
  fastify.get("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;
    const status = (request.query as any).status || "pending";
    const campaignId = (request.query as any).campaignId;
    const limit = Number((request.query as any).limit ?? 50);
    const skip = Number((request.query as any).skip ?? 0);
    const res = campaignId
      ? await ProfileRepo.findByCampaignStatus(campaignId, status, limit, skip)
      : await ProfileRepo.findByStatus(status, limit, skip);
    reply.send(res);
  });

  // Get profile by ID
  fastify.get("/:id", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;
    const profile = await ProfileRepo.findById((request.params as any).id);
    if (!profile) {
      reply.code(404).send({ error: "PROFILE_NOT_FOUND" });
      return;
    }
    reply.send(profile);
  });

  // Search profiles by text
  fastify.get("/search", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;
    const query = (request.query as any).q;
    if (!query || query.length < 2) {
      reply.code(400).send({ error: "INVALID_QUERY", message: "Query must be at least 2 characters" });
      return;
    }
    const limit = Number((request.query as any).limit ?? 50);
    const results = await ProfileRepo.searchByText(query, limit);
    reply.send(results);
  });

  // Get count by status for a campaign
  fastify.get("/count", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;
    const campaignId = (request.query as any).campaignId;
    const counts = await ProfileRepo.countByStatus(campaignId);
    reply.send(counts);
  });

  // Single profile approve
  fastify.post("/:id/approve", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const updated = await ProfileRepo.setStatus(id, "approved");
    if (!updated) {
      reply.code(404).send({ error: "PROFILE_NOT_FOUND" });
      return;
    }
    trackingEvent("profile.status", { status: "approved", id });
    reply.code(200).send(updated);
  });

  // Single profile reject
  fastify.post("/:id/reject", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;
    const id = (request.params as any).id;
    const reason = (request.body as any)?.reason;
    const updated = await ProfileRepo.setStatus(id, "rejected");
    if (!updated) {
      reply.code(404).send({ error: "PROFILE_NOT_FOUND" });
      return;
    }
    trackingEvent("profile.status", { status: "rejected", id, reason });
    reply.code(200).send(updated);
  });

  // Batch approve multiple profiles
  fastify.post("/batch/approve", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;
    const ids: string[] = (request.body as any)?.ids;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      reply.code(400).send({ error: "INVALID_IDS", message: "ids must be a non-empty array" });
      return;
    }
    if (ids.length > 100) {
      reply.code(400).send({ error: "TOO_MANY_IDS", message: "Maximum 100 profiles per batch" });
      return;
    }
    const result = await ProfileRepo.batchApprove(ids);
    trackingEvent("profile.batch", { action: "approve", count: ids.length });
    reply.send({ modified: result.modifiedCount, matched: result.matchedCount });
  });

  // Batch reject multiple profiles
  fastify.post("/batch/reject", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;
    const ids: string[] = (request.body as any)?.ids;
    const reason = (request.body as any)?.reason;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      reply.code(400).send({ error: "INVALID_IDS", message: "ids must be a non-empty array" });
      return;
    }
    if (ids.length > 100) {
      reply.code(400).send({ error: "TOO_MANY_IDS", message: "Maximum 100 profiles per batch" });
      return;
    }
    const result = await ProfileRepo.batchReject(ids, reason);
    trackingEvent("profile.batch", { action: "reject", count: ids.length, reason });
    reply.send({ modified: result.modifiedCount, matched: result.matchedCount });
  });

  // Create or update profile
  fastify.post("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    // Validate with Zod schema (optional but recommended)
    const parsed = ProfileCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      // Allow through anyway for backwards compatibility, just log warning
      console.warn("[profiles] Validation warning:", parsed.error.issues);
    }

    const created = await ProfileRepo.upsertByPlatformUsername(request.body as any);
    trackingEvent("profile.upsert", { platform: (request.body as any)?.platform, username: (request.body as any)?.username });
    reply.code(201).send(created);
  });

  // Find profiles by interests
  fastify.post("/find-by-interests", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;
    const interests: string[] = (request.body as any)?.interests;
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      reply.code(400).send({ error: "INVALID_INTERESTS", message: "interests must be a non-empty array" });
      return;
    }
    const limit = Number((request.query as any).limit ?? 50);
    const results = await ProfileRepo.findByInterests(interests, limit);
    reply.send(results);
  });
};