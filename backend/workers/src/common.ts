import { createClient } from "redis";

export async function connectRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();
  return client;
}

export async function loopQueue(client: any, queue: string, handler: (payload: any) => Promise<void>) {
  for (;;) {
    const item = await client.blPop(queue, 0);
    if (!item) continue;
    const payload = JSON.parse(item.element);
    try {
      await handler(payload);
      await client.incr(`metrics:worker_processed_total:${queue}`);
    } catch (e) {
      await client.incr(`metrics:worker_errors_total:${queue}`);
    }
    console.log(`[worker] processed from ${queue}`);
  }
}
