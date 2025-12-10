import { FastifyPluginAsync } from "fastify";
import { ProfileRepo } from "../repos.js";
import { trackingEvent } from "../lib/events.js";
import { ProfileCreateSchema } from "../dto.js";
import { AdvancedFilterSchema, buildAdvancedQuery, parseBooleanQuery } from "../lib/advanced-filter.js";
import { dispatchWebhooks } from "../services/webhook-dispatcher.js";

export const profilesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profiles
   * List profiles with basic filters
   */
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

    reply.send({
      success: true,
      data: res,
      meta: { limit, skip, status, campaignId }
    });
  });

  /**
   * POST /profiles/advanced-search
   * Advanced search with boolean query support
   * 
   * Body:
   * {
   *   "query": "optional text search",
   *   "filters": {
   *     "status": "pending",
   *     "platform": "twitter",
   *     "followersMin": 1000,
   *     "followersMax": 100000,
   *     "qualityScoreMin": 70,
   *     "botProbabilityMax": 30,
   *     "interests": ["ai", "tech"],
   *     "interestsMatchAll": false,
   *     "booleanQuery": "(interests:ai OR interests:ml) AND followers:>5000 AND NOT status:rejected"
   *   }
   * }
   */
  fastify.post("/advanced-search", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const parsed = AdvancedFilterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.issues
      });
    }

    const limit = Number((request.query as any).limit ?? 50);
    const skip = Number((request.query as any).skip ?? 0);
    const sort = (request.query as any).sort || "-createdAt";

    try {
      // Build MongoDB query from advanced filters
      const mongoQuery = buildAdvancedQuery(parsed.data);

      // Add text search if provided
      if (parsed.data.query && parsed.data.query.length >= 2) {
        mongoQuery.$text = { $search: parsed.data.query };
      }

      // Execute query with proper typing
      const profiles = await ProfileRepo.findAdvanced(mongoQuery, {
        limit,
        skip,
        sort: parseSortString(sort)
      });

      const total = await ProfileRepo.countAdvanced(mongoQuery);

      reply.send({
        success: true,
        data: profiles,
        meta: {
          total,
          limit,
          skip,
          hasMore: skip + profiles.length < total,
          query: parsed.data.filters?.booleanQuery || null
        }
      });
    } catch (err: any) {
      reply.code(400).send({
        success: false,
        error: "QUERY_ERROR",
        message: err.message
      });
    }
  });

  /**
   * POST /profiles/query
   * Execute a raw boolean query
   * 
   * Body: { "booleanQuery": "interests:tech AND followers:>1000" }
   */
  fastify.post("/query", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const { booleanQuery } = request.body as { booleanQuery?: string };

    if (!booleanQuery || booleanQuery.trim() === "") {
      return reply.code(400).send({
        success: false,
        error: "MISSING_QUERY",
        message: "booleanQuery is required"
      });
    }

    const limit = Number((request.query as any).limit ?? 50);
    const skip = Number((request.query as any).skip ?? 0);

    // Parse the boolean query
    const { mongoQuery, errors } = parseBooleanQuery(booleanQuery);

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: "PARSE_ERROR",
        message: "Failed to parse boolean query",
        details: errors
      });
    }

    try {
      const profiles = await ProfileRepo.findAdvanced(mongoQuery, { limit, skip });
      const total = await ProfileRepo.countAdvanced(mongoQuery);

      reply.send({
        success: true,
        data: profiles,
        meta: {
          total,
          limit,
          skip,
          hasMore: skip + profiles.length < total,
          parsedQuery: mongoQuery
        }
      });
    } catch (err: any) {
      reply.code(500).send({
        success: false,
        error: "QUERY_EXECUTION_ERROR",
        message: err.message
      });
    }
  });

  /**
   * GET /profiles/query-help
   * Documentation for boolean query syntax
   */
  fastify.get("/query-help", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    reply.send({
      success: true,
      data: {
        syntax: {
          description: "Boolean query language for advanced profile filtering",
          operators: {
            AND: "Combine conditions (both must match)",
            OR: "Either condition can match",
            NOT: "Exclude matching profiles",
            "(...)": "Group conditions for precedence"
          },
          comparisons: {
            ":value": "Exact match (case-insensitive)",
            ":>N": "Greater than N",
            ":>=N": "Greater than or equal to N",
            ":<N": "Less than N",
            ":<=N": "Less than or equal to N",
            ":*text*": "Contains text (wildcard)"
          },
          fields: [
            "status", "platform", "username", "displayName", "bio",
            "location", "followers", "following", "posts",
            "interests", "qualityScore", "botProbability", "verified"
          ]
        },
        examples: [
          {
            query: "interests:tech",
            description: "Profiles interested in tech"
          },
          {
            query: "platform:twitter AND followers:>1000",
            description: "Twitter profiles with 1000+ followers"
          },
          {
            query: "(interests:ai OR interests:ml) AND NOT status:rejected",
            description: "AI/ML interests, excluding rejected"
          },
          {
            query: "bio:*startup* AND qualityScore:>=80",
            description: "Bios mentioning startup with high quality"
          },
          {
            query: "followers:>=10000 AND followers:<=100000 AND verified:true",
            description: "Verified accounts with 10K-100K followers"
          }
        ]
      }
    });
  });

  /**
   * GET /profiles/:id
   * Get profile by ID
   */
  fastify.get("/:id", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const profile = await ProfileRepo.findById((request.params as any).id);
    if (!profile) {
      return reply.code(404).send({ success: false, error: "PROFILE_NOT_FOUND" });
    }

    reply.send({ success: true, data: profile });
  });

  /**
   * GET /profiles/search
   * Text search across profile fields
   */
  fastify.get("/search", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const query = (request.query as any).q;
    if (!query || query.length < 2) {
      return reply.code(400).send({
        success: false,
        error: "INVALID_QUERY",
        message: "Query must be at least 2 characters"
      });
    }

    const limit = Number((request.query as any).limit ?? 50);
    const results = await ProfileRepo.searchByText(query, limit);

    reply.send({ success: true, data: results });
  });

  /**
   * GET /profiles/count
   * Get counts by status
   */
  fastify.get("/count", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const campaignId = (request.query as any).campaignId;
    const counts = await ProfileRepo.countByStatus(campaignId);

    reply.send({ success: true, data: counts });
  });

  /**
   * POST /profiles/:id/approve
   * Approve single profile
   */
  fastify.post("/:id/approve", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    const id = (request.params as any).id;
    const updated = await ProfileRepo.setStatus(id, "approved");

    if (!updated) {
      return reply.code(404).send({ success: false, error: "PROFILE_NOT_FOUND" });
    }

    trackingEvent("profile.status", { status: "approved", id });

    // Dispatch webhook
    const userId = request.user?.id;
    await dispatchWebhooks("profile.approved", {
      profileId: id,
      username: updated.username,
      platform: updated.platform,
      timestamp: new Date().toISOString()
    }, userId);

    reply.send({ success: true, data: updated });
  });

  /**
   * POST /profiles/:id/reject
   * Reject single profile
   */
  fastify.post("/:id/reject", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    const id = (request.params as any).id;
    const reason = (request.body as any)?.reason;
    const updated = await ProfileRepo.setStatus(id, "rejected");

    if (!updated) {
      return reply.code(404).send({ success: false, error: "PROFILE_NOT_FOUND" });
    }

    trackingEvent("profile.status", { status: "rejected", id, reason });

    // Dispatch webhook
    const userId = request.user?.id;
    await dispatchWebhooks("profile.rejected", {
      profileId: id,
      username: updated.username,
      platform: updated.platform,
      reason,
      timestamp: new Date().toISOString()
    }, userId);

    reply.send({ success: true, data: updated });
  });

  /**
   * POST /profiles/batch/approve
   * Batch approve profiles
   */
  fastify.post("/batch/approve", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    const ids: string[] = (request.body as any)?.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({
        success: false,
        error: "INVALID_IDS",
        message: "ids must be a non-empty array"
      });
    }

    if (ids.length > 100) {
      return reply.code(400).send({
        success: false,
        error: "TOO_MANY_IDS",
        message: "Maximum 100 profiles per batch"
      });
    }

    const result = await ProfileRepo.batchApprove(ids);
    trackingEvent("profile.batch", { action: "approve", count: ids.length });

    // Dispatch webhook
    const userId = request.user?.id;
    await dispatchWebhooks("profile.batch.approved", {
      count: result.modifiedCount,
      profileIds: ids,
      timestamp: new Date().toISOString()
    }, userId);

    reply.send({
      success: true,
      data: { modified: result.modifiedCount, matched: result.matchedCount }
    });
  });

  /**
   * POST /profiles/batch/reject
   * Batch reject profiles
   */
  fastify.post("/batch/reject", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    const ids: string[] = (request.body as any)?.ids;
    const reason = (request.body as any)?.reason;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({
        success: false,
        error: "INVALID_IDS",
        message: "ids must be a non-empty array"
      });
    }

    if (ids.length > 100) {
      return reply.code(400).send({
        success: false,
        error: "TOO_MANY_IDS",
        message: "Maximum 100 profiles per batch"
      });
    }

    const result = await ProfileRepo.batchReject(ids, reason);
    trackingEvent("profile.batch", { action: "reject", count: ids.length, reason });

    // Dispatch webhook
    const userId = request.user?.id;
    await dispatchWebhooks("profile.batch.rejected", {
      count: result.modifiedCount,
      profileIds: ids,
      reason,
      timestamp: new Date().toISOString()
    }, userId);

    reply.send({
      success: true,
      data: { modified: result.modifiedCount, matched: result.matchedCount }
    });
  });

  /**
   * POST /profiles
   * Create or update profile
   */
  fastify.post("/", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.write")(request, reply);
    if (!permitted) return;

    const parsed = ProfileCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      console.warn("[profiles] Validation warning:", parsed.error.issues);
    }

    const created = await ProfileRepo.upsertByPlatformUsername(request.body as any);
    trackingEvent("profile.upsert", {
      platform: (request.body as any)?.platform,
      username: (request.body as any)?.username
    });

    reply.code(201).send({ success: true, data: created });
  });

  /**
   * POST /profiles/find-by-interests
   * Find profiles by interests (legacy, use advanced-search instead)
   */
  fastify.post("/find-by-interests", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("profiles.read")(request, reply);
    if (!permitted) return;

    const interests: string[] = (request.body as any)?.interests;

    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return reply.code(400).send({
        success: false,
        error: "INVALID_INTERESTS",
        message: "interests must be a non-empty array"
      });
    }

    const limit = Number((request.query as any).limit ?? 50);
    const results = await ProfileRepo.findByInterests(interests, limit);

    reply.send({ success: true, data: results });
  });
};

/**
 * Parse sort string like "-createdAt" into MongoDB sort object
 */
function parseSortString(sort: string): Record<string, 1 | -1> {
  const result: Record<string, 1 | -1> = {};
  const parts = sort.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith("-")) {
      result[trimmed.slice(1)] = -1;
    } else {
      result[trimmed] = 1;
    }
  }

  return Object.keys(result).length > 0 ? result : { createdAt: -1 };
}