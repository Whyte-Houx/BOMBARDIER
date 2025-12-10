import Fastify, { FastifyRequest, FastifyInstance } from "fastify";
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
import { webhooksRoutes } from "./routes/webhooks.js";
import { realtimeRoutes, realtimeNotifier } from "./services/realtime-notifier.js";
import { rateLimitPlugin, defaultRateLimitConfig } from "./lib/rate-limiter.js";
import { apiVersionPlugin, v2PreviewRoutes, API_VERSIONS } from "./lib/api-versioning.js";

const server = Fastify({ logger: true });

// ============================================================================
// Core Middleware
// ============================================================================

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
// Database Connections
// ============================================================================

const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/bombardier";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

await connectMongo(mongoUri);
const redis = await getRedis(redisUrl);

// ============================================================================
// Advanced Plugins
// ============================================================================

// API Versioning Framework
await server.register(apiVersionPlugin, {
  versions: API_VERSIONS,
  defaultVersion: 1,
  versionHeader: 'X-API-Version',
  enableMigrationWarnings: true
});

// Advanced Per-Endpoint Rate Limiting
try {
  await server.register(rateLimitPlugin, {
    redis,
    config: defaultRateLimitConfig
  });
  server.log.info("Advanced rate limiting enabled");
} catch (err) {
  server.log.warn(`Advanced rate limiting failed to initialize: ${String(err)}`);
}

// ============================================================================
// Infrastructure Routes (No Version Prefix)
// ============================================================================

// Health & Metrics (Public / Infrastructure)
await server.register(healthRoutes, { prefix: "/health" });
await server.register(metricsRoutes, { prefix: "/metrics" });

// Root endpoint
server.get("/", async () => ({
  message: "ok",
  service: "bombardier-api",
  version: "2.1.0",
  api: {
    current: "/v1",
    versions: ["v1", "v2"],
    preview: "/v2",
    documentation: "/api/versions"
  },
  features: {
    realtime: "/v1/realtime/ws",
    webhooks: "/v1/webhooks",
    advancedFiltering: "/v1/profiles/advanced-search"
  },
  timestamp: new Date().toISOString()
}));

// ============================================================================
// API Version 1 (/v1)
// ============================================================================

async function registerV1Routes(app: FastifyInstance) {
  // Authentication (Public entry points)
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(oauthRoutes, { prefix: "/oauth" });

  // Core Business Logic (Protected)
  await app.register(pipelineRoutes, { prefix: "/pipeline" });
  await app.register(profilesRoutes, { prefix: "/profiles" });
  await app.register(messagesRoutes, { prefix: "/messages" });
  await app.register(campaignsRoutes, { prefix: "/campaigns" });
  await app.register(trackingRoutes, { prefix: "/tracking" });
  await app.register(analyticsRoutes, { prefix: "/analytics" });

  // Cloak Anti-Detection System (Protected)
  await app.register(cloakRoutes, { prefix: "/cloak" });

  // Webhooks (Protected)
  await app.register(webhooksRoutes, { prefix: "/webhooks" });

  // Real-time Notifications (WebSocket)
  await app.register(realtimeRoutes, { prefix: "/realtime" });

  // Version info
  app.get("/", async () => ({
    version: "1",
    status: "current",
    endpoints: [
      "/auth", "/oauth", "/pipeline", "/profiles", "/messages",
      "/campaigns", "/tracking", "/analytics", "/cloak", "/webhooks",
      "/realtime"
    ]
  }));
}

// Register v1 routes
await server.register(registerV1Routes, { prefix: "/v1" });

// ============================================================================
// API Version 2 Preview (/v2) - Experimental
// ============================================================================

await server.register(v2PreviewRoutes, { prefix: "/v2" });

// ============================================================================
// Legacy Routes (Deprecated - will redirect to /v1)
// ============================================================================

// Maintain backwards compatibility by also registering routes at root
// These will be deprecated in future versions
await server.register(authRoutes, { prefix: "/auth" });
await server.register(oauthRoutes, { prefix: "/oauth" });
await server.register(pipelineRoutes, { prefix: "/pipeline" });
await server.register(profilesRoutes, { prefix: "/profiles" });
await server.register(messagesRoutes, { prefix: "/messages" });
await server.register(campaignsRoutes, { prefix: "/campaigns" });
await server.register(trackingRoutes, { prefix: "/tracking" });
await server.register(analyticsRoutes, { prefix: "/analytics" });
await server.register(cloakRoutes, { prefix: "/cloak" });
await server.register(webhooksRoutes, { prefix: "/webhooks" });

// Add deprecation warning header to legacy routes
server.addHook("onSend", async (request, reply, payload) => {
  const legacyPrefixes = ["/auth", "/oauth", "/pipeline", "/profiles", "/messages", "/campaigns", "/tracking", "/analytics", "/cloak", "/webhooks"];
  const isLegacy = legacyPrefixes.some(p => request.url.startsWith(p) && !request.url.startsWith("/v1"));

  if (isLegacy) {
    reply.header("Deprecation", "true");
    reply.header("Sunset", "2025-06-01");
    reply.header("Link", `</v1${request.url}>; rel="successor-version"`);
  }

  return payload;
});

// ============================================================================
// Hooks & Middleware
// ============================================================================

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
  const sensitiveRoutes = ["/auth", "/campaigns", "/profiles/batch", "/webhooks"];
  const isSensitive = sensitiveRoutes.some(r => request.url.includes(r));

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
server.log.info(`🔗 API Version: v1 (current) - Legacy routes deprecated, sunset 2025-06-01`);
