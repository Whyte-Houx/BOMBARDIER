import { connectRedis, loopQueue } from "./common.js";
import { handle } from "./engagement-logic.js";

/**
 * Engagement Worker Entry Point
 */

console.log("[engagement-worker] Starting up...");

// Connect to Redis
const redis = await connectRedis();

console.log("[engagement-worker] Key dependencies loaded, waiting for jobs...");

// Start processing queue
// We wrap the handle function to pass the redis client for queuing subsequent jobs (tracking)
await loopQueue(redis, "queue:engagement", (payload) => handle(payload, redis));

console.log("[engagement-worker] Worker stopped.");