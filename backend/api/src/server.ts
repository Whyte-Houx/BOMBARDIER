import Fastify from "fastify";
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

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
});
await server.register(jwtPlugin);
await server.register(jwksPlugin);
await server.register(rbacPlugin);
try {
  const cookie = await import("@fastify/cookie");
  await server.register((cookie as any).default || (cookie as any));
} catch { }
try {
  const websocket = await import("@fastify/websocket");
  await server.register((websocket as any).default || (websocket as any));
} catch { }
await server.register(healthRoutes, { prefix: "/health" });
await server.register(authRoutes, { prefix: "/auth" });
await server.register(pipelineRoutes, { prefix: "/pipeline" });
await server.register(metricsRoutes, { prefix: "/metrics" });
await server.register(oauthRoutes, { prefix: "/oauth" });
await server.register(profilesRoutes, { prefix: "/profiles" });
await server.register(messagesRoutes, { prefix: "/messages" });
await server.register(campaignsRoutes, { prefix: "/campaigns" });
await server.register(trackingRoutes, { prefix: "/tracking" });
await server.register(analyticsRoutes, { prefix: "/analytics" });

const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/bombardier";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
await connectMongo(mongoUri);
await getRedis(redisUrl);
const port = Number(process.env.PORT || 4050);
server.get("/", async () => ({ message: "ok" }));
server.addHook("onResponse", async (request, reply) => {
  try {
    const route = request.routerPath || request.url;
    httpHistogram.labels({ route, method: request.method }).observe((reply.getResponseTime?.() as number) || 0);
  } catch { }
});
server.addHook("onError", async (request, reply, error) => {
  try {
    const route = request.routerPath || request.url;
    const code = String(reply.statusCode || 500);
    httpErrors.labels({ route, code }).inc();
  } catch { }
});

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
await server.listen({ port, host: "0.0.0.0" });
