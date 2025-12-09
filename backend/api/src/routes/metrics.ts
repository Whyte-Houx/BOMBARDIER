import { FastifyPluginAsync } from "fastify";
import { registry, queueSize, workerProcessed, workerErrors } from "../metrics.js";
import { getRedis } from "../lib/redis.js";

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request: any, reply: any) => {
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
    } catch {}
    const data = await registry.metrics();
    reply.header("Content-Type", (registry as any).contentType).send(data);
  });
};