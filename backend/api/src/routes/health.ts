import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

/**
 * Health Check Routes
 * 
 * Security Model:
 * - `/health/` - PUBLIC: For load balancers, Kubernetes probes, uptime monitors
 * - `/health/detailed` - PROTECTED: Exposes internal dependency status (requires system.read)
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /health/
   * Basic health check - always public
   * Used by: Load balancers, Kubernetes liveness probes, uptime monitors
   */
  fastify.get("/", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "bombardier-api",
    version: "1.0.0"
  }));

  /**
   * GET /health/detailed
   * Detailed health check with dependency status
   * PROTECTED: Requires system.read permission (exposes internal infrastructure info)
   */
  fastify.get("/detailed", async (request: FastifyRequest, reply: FastifyReply) => {
    // Check authentication - requires system.read or admin role
    const user = (request as any).user;

    if (!user) {
      reply.code(401).send({
        success: false,
        error: "UNAUTHENTICATED",
        message: "Detailed health check requires authentication"
      });
      return;
    }

    // Check for admin role or system.read permission
    if (user.role !== "admin" && !user.isInternal) {
      const permitted = await (fastify as any).requirePermission("system.read")(request, reply);
      if (!permitted) return;
    }

    const health: {
      success: boolean;
      status: string;
      timestamp: string;
      service: string;
      version: string;
      uptime: number;
      dependencies: {
        mongodb: { status: string; latency?: number; error?: string };
        redis: { status: string; latency?: number; error?: string };
      };
    } = {
      success: true,
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "bombardier-api",
      version: "1.0.0",
      uptime: process.uptime(),
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
    } catch (err: any) {
      health.dependencies.mongodb = {
        status: "error",
        error: err?.message || "Unknown error"
      };
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
    } catch (err: any) {
      health.dependencies.redis = {
        status: "error",
        error: err?.message || "Unknown error"
      };
      health.status = "degraded";
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    reply.code(statusCode).send(health);
  });

  /**
   * GET /health/ready
   * Readiness probe - checks if service can accept traffic
   * PUBLIC: For Kubernetes readiness probes
   */
  fastify.get("/ready", async (request, reply) => {
    try {
      // Quick check that dependencies are connected
      const mongoose = await import("mongoose");
      const { getRedis } = await import("../lib/redis.js");

      const mongoReady = mongoose.connection.readyState === 1;
      const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
      await redis.ping();
      const redisReady = true;

      if (mongoReady && redisReady) {
        reply.code(200).send({ ready: true });
      } else {
        reply.code(503).send({ ready: false, reason: "Dependencies not ready" });
      }
    } catch (err) {
      reply.code(503).send({ ready: false, reason: "Health check failed" });
    }
  });

  /**
   * GET /health/live
   * Liveness probe - checks if process is alive
   * PUBLIC: For Kubernetes liveness probes
   */
  fastify.get("/live", async () => ({
    alive: true,
    timestamp: new Date().toISOString()
  }));
};