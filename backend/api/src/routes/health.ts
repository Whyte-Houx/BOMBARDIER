import { FastifyPluginAsync } from "fastify";

/**
 * Health Check Routes
 * 
 * These endpoints are intentionally PUBLIC for:
 * - Load balancer health checks
 * - Kubernetes liveness/readiness probes
 * - Uptime monitoring services
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check - always public
  fastify.get("/", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "bombardier-api",
    version: "1.0.0"
  }));

  // Detailed health check - includes dependency status
  fastify.get("/detailed", async (request, reply) => {
    const health: {
      status: string;
      timestamp: string;
      service: string;
      version: string;
      dependencies: {
        mongodb: { status: string; latency?: number };
        redis: { status: string; latency?: number };
      };
    } = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "bombardier-api",
      version: "1.0.0",
      dependencies: {
        mongodb: { status: "unknown" },
        redis: { status: "unknown" }
      }
    };

    // Check MongoDB
    try {
      const mongoose = await import("mongoose");
      const start = Date.now();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db?.admin().ping();
        health.dependencies.mongodb = {
          status: "healthy",
          latency: Date.now() - start
        };
      } else {
        health.dependencies.mongodb = { status: "disconnected" };
        health.status = "degraded";
      }
    } catch (err) {
      health.dependencies.mongodb = { status: "error" };
      health.status = "degraded";
    }

    // Check Redis
    try {
      const { getRedis } = await import("../lib/redis.js");
      const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
      const start = Date.now();
      await redis.ping();
      health.dependencies.redis = {
        status: "healthy",
        latency: Date.now() - start
      };
    } catch (err) {
      health.dependencies.redis = { status: "error" };
      health.status = "degraded";
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    reply.code(statusCode).send(health);
  });
};