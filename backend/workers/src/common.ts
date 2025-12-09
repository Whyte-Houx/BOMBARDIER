import { createClient } from "redis";

export async function connectRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();
  return client;
}

export async function loopQueue(client: any, queue: string, handler: (payload: any) => Promise<void>) {
  for (; ;) {
    const item = await client.blPop(queue, 0);
    if (!item) continue;

    // Support both simple string and object response from newer redis client versions
    const itemStr = typeof item === 'object' && item.element ? item.element : item;

    let payload;
    try {
      payload = JSON.parse(itemStr);
      await handler(payload);
      await client.incr(`metrics:worker_processed_total:${queue}`);
    } catch (e) {
      console.error(`[worker] Error processing item from ${queue}:`, e);
      await client.incr(`metrics:worker_errors_total:${queue}`);

      // Dead Letter Queue Strategy
      // Push the original item string to a failed queue for later inspection/replay
      try {
        await client.rPush(`queue:failed:${queue}`, itemStr);
        console.log(`[worker] Moved failed item to queue:failed:${queue}`);
      } catch (dlqError) {
        console.error(`[worker] CRITICAL: Failed to push to DLQ`, dlqError);
      }
    }
  }
}
