import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { registry, queueSize, workerProcessed, workerErrors } from "../metrics.js";
import { getRedis } from "../lib/redis.js";

/**
 * Metrics Routes - Prometheus Format
 * 
 * SECURITY: Metrics expose internal system information and should be protected.
 * 
 * Access Control:
 * - Requires `system.read` permission, OR
 * - Prometheus bearer token (X-Prometheus-Token header), OR
 * - Internal API key (for internal monitoring)
 */

const PROMETHEUS_TOKEN = process.env.PROMETHEUS_TOKEN || "";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "bombardier-internal-key-dev";

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    // Check authentication
    const isAuthenticated = await checkMetricsAuth(fastify, request, reply);
    if (!isAuthenticated) return;

    try {
      const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
      const queues = ["queue:acquisition", "queue:filtering", "queue:research", "queue:engagement", "queue:tracking"];

      for (const q of queues) {
        const len = await redis.lLen(q);
        queueSize.labels({ queue: q }).set(len);
        const count = Number(await redis.get(`metrics:worker_processed_total:${q}`)) || 0;
        workerProcessed.labels({ queue: q }).set(count);
        const err = Number(await redis.get(`metrics:worker_errors_total:${q}`)) || 0;
        workerErrors.labels({ queue: q }).set(err);
      }
    } catch (err) {
      fastify.log.warn({ err }, "Failed to fetch queue metrics from Redis");
    }

    const data = await registry.metrics();
    reply.header("Content-Type", (registry as any).contentType).send(data);
  });
};

/**
 * Check if the request is authorized to access metrics
 */
async function checkMetricsAuth(
  fastify: any,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  // 1. Check for Prometheus token (for Prometheus scraping)
  const prometheusToken = request.headers["x-prometheus-token"];
  if (PROMETHEUS_TOKEN && prometheusToken === PROMETHEUS_TOKEN) {
    return true;
  }

  // 2. Check for internal API key (for internal monitoring)
  const apiKey = request.headers["x-api-key"] || request.headers["x-internal-key"];
  if (apiKey === INTERNAL_API_KEY) {
    return true;
  }

  // 3. Check for authenticated user with system.read permission
  const user = (request as any).user;
  if (user) {
    // Admin always has access
    if (user.role === "admin" || user.isInternal) {
      return true;
    }

    // Check system.read permission via RBAC
    const permitted = await fastify.requirePermission("system.read")(request, reply);
    if (permitted) {
      return true;
    }
    // Reply already sent by requirePermission
    return false;
  }

  // No authentication provided
  reply.code(401).send({
    error: "UNAUTHENTICATED",
    message: "Metrics endpoint requires authentication. Use Authorization header, X-Prometheus-Token, or X-Api-Key."
  });
  return false;
}