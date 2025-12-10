import Fastify, { FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { rbacPlugin } from "./plugins/rbac.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { jwksPlugin } from "./plugins/jwks.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { pipelineRoutes } from "./routes/pipeline.js";
import { connectMongo } from "./lib/mongo.js";
import { getRedis } from "./lib/redis.js";
import { metricsRoutes } from "./routes/metrics.js";
import { oauthRoutes } from "./routes/oauth.js";
import { httpHistogram, httpErrors, queueSize, workerProcessed, workerErrors } from "./metrics.js";
import { profilesRoutes } from "./routes/profiles.js";
import { messagesRoutes } from "./routes/messages.js";
import { campaignsRoutes } from "./routes/campaigns.js";
import { trackingRoutes } from "./routes/tracking.js";
import { analyticsRoutes } from "./routes/analytics.js";
import cloakRoutes from "./routes/cloak.js";

const server = Fastify({ logger: true });

// CORS Configuration
await server.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
});

// Rate Limiting - Per IP, with higher limits for authenticated users
try {
  // @ts-ignore - Optional dependency, may not be installed
  const rateLimit = await import("@fastify/rate-limit" as string);
  await server.register((rateLimit as any).default || rateLimit, {
    max: 100, // 100 requests per minute for unauthenticated
    timeWindow: "1 minute",
    keyGenerator: (request: FastifyRequest): string => {
      // Use user ID if authenticated, otherwise use IP
      const user = (request as any).user;
      if (user && !user.isMock) {
        return `user:${user.id}`;
      }
      return request.ip;
    },
    errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number }): object => ({
      error: "RATE_LIMIT_EXCEEDED",
      message: `Too many requests. Retry after ${Math.round(context.ttl / 1000)} seconds.`,
      retryAfter: Math.round(context.ttl / 1000)
    })
  });
  server.log.info("Rate limiting enabled");
} catch (err) {
  server.log.warn("Rate limiting not available - @fastify/rate-limit not installed");
}

// Authentication & Authorization
await server.register(jwtPlugin);
await server.register(jwksPlugin);
await server.register(rbacPlugin);

// Cookie support
try {
  const cookie = await import("@fastify/cookie");
  await server.register((cookie as any).default || (cookie as any));
} catch { }

// WebSocket support
try {
  const websocket = await import("@fastify/websocket");
  await server.register((websocket as any).default || (websocket as any));
} catch { }

// ============================================================================
// Route Registration
// ============================================================================

// Health & Metrics (Public)
await server.register(healthRoutes, { prefix: "/health" });
await server.register(metricsRoutes, { prefix: "/metrics" });

// Authentication (Public entry points)
await server.register(authRoutes, { prefix: "/auth" });
await server.register(oauthRoutes, { prefix: "/oauth" });

// Core Business Logic (Protected)
await server.register(pipelineRoutes, { prefix: "/pipeline" });
await server.register(profilesRoutes, { prefix: "/profiles" });
await server.register(messagesRoutes, { prefix: "/messages" });
await server.register(campaignsRoutes, { prefix: "/campaigns" });
await server.register(trackingRoutes, { prefix: "/tracking" });
await server.register(analyticsRoutes, { prefix: "/analytics" });

// Cloak Anti-Detection System (Protected - requires auth)
await server.register(cloakRoutes, { prefix: "/cloak" });

// ============================================================================
// Database Connections
// ============================================================================

const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/bombardier";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

await connectMongo(mongoUri);
await getRedis(redisUrl);

// ============================================================================
// Hooks & Middleware
// ============================================================================

// Root endpoint
server.get("/", async () => ({
  message: "ok",
  service: "bombardier-api",
  version: "1.0.0",
  timestamp: new Date().toISOString()
}));

// Request timing metrics
server.addHook("onResponse", async (request, reply) => {
  try {
    const route = request.routerPath || request.url;
    httpHistogram.labels({ route, method: request.method }).observe((reply.getResponseTime?.() as number) || 0);
  } catch { }
});

// Error tracking
server.addHook("onError", async (request, reply, error) => {
  try {
    const route = request.routerPath || request.url;
    const code = String(reply.statusCode || 500);
    httpErrors.labels({ route, code }).inc();
  } catch { }
});

// Audit logging hook
server.addHook("onResponse", async (request, reply) => {
  const user = (request as any).user;
  const sensitiveRoutes = ["/auth", "/campaigns", "/profiles/batch"];
  const isSensitive = sensitiveRoutes.some(r => request.url.startsWith(r));

  if (isSensitive && user && !user.isMock) {
    server.log.info({
      type: "audit",
      userId: user.id,
      role: user.role,
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// Queue Metrics Polling
// ============================================================================

const queuesToPoll = ["queue:acquisition", "queue:filtering", "queue:research", "queue:engagement", "queue:tracking"];

setInterval(async () => {
  try {
    const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
    for (const q of queuesToPoll) {
      const len = await redis.lLen(q);
      queueSize.labels({ queue: q }).set(len);
      const count = Number(await redis.get(`metrics:worker_processed_total:${q}`)) || 0;
      workerProcessed.labels({ queue: q }).set(count);
      const err = Number(await redis.get(`metrics:worker_errors_total:${q}`)) || 0;
      workerErrors.labels({ queue: q }).set(err);
    }
  } catch { }
}, 10000);

// ============================================================================
// Server Start
// ============================================================================

const port = Number(process.env.PORT || 4050);
await server.listen({ port, host: "0.0.0.0" });

server.log.info(`🚀 Bombardier API running on port ${port}`);
server.log.info(`📊 Auth mode: ${process.env.AUTH_DISABLED === "true" ? "DISABLED (mock admin)" : "ENABLED"}`);
