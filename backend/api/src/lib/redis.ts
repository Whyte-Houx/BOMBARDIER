import { createClient } from "redis";

let client: ReturnType<typeof createClient> | undefined;
export async function getRedis(url: string) {
  if (client) return client;
  client = createClient({ url });
  await client.connect();
  return client;
}

export async function enqueue(key: string, value: string) {
  if (!client) throw new Error("redis not connected");
  await client.rPush(key, value);
}

export async function dequeue(key: string) {
  if (!client) throw new Error("redis not connected");
  return client.lPop(key);
}

export async function setWithTTL(key: string, value: string, ttlSeconds: number) {
  if (!client) throw new Error("redis not connected");
  await client.set(key, value, { EX: ttlSeconds });
}

export async function getKey(key: string) {
  if (!client) throw new Error("redis not connected");
  return client.get(key);
}

export async function delKey(key: string) {
  if (!client) throw new Error("redis not connected");
  await client.del(key);
}