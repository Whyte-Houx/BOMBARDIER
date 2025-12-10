import { createClient } from "redis";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = process.env.API_URL || "http://localhost:4050";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "bombardier-internal-key-dev";

export function getApiBase(): string {
  return API_BASE;
}

// ============================================================================
// API Client with Internal Authentication
// ============================================================================

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make authenticated API request using internal API key
 * Workers use this to communicate with the main API
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Key": INTERNAL_API_KEY,
    ...options.headers
  };

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  return fetch(url, fetchOptions);
}

/**
 * Convenience method for GET requests
 */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new Error(`API GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Convenience method for POST requests
 */
export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const res = await apiFetch(path, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`API POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// Redis Connection
// ============================================================================

export async function connectRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();
  return client;
}

// ============================================================================
// Queue Processing with DLQ
// ============================================================================

export async function loopQueue(client: any, queue: string, handler: (payload: any) => Promise<void>) {
  console.log(`[worker] Listening on ${queue}...`);

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
      console.log(`[worker] Processed item from ${queue}`);
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

// ============================================================================
// Analytics Event Recording
// ============================================================================

/**
 * Record an analytics event (uses internal API)
 */
export async function recordAnalyticsEvent(
  type: string,
  context: { campaignId?: string; userId?: string; platform?: string },
  metrics: Record<string, number> = {}
): Promise<void> {
  try {
    await apiPost("/analytics/event", { type, ...context, metrics });
  } catch (err) {
    console.error(`[worker] Failed to record analytics event:`, err);
  }
}

/**
 * Record a metric (uses internal API)
 */
export async function recordMetric(
  context: { campaignId?: string; userId?: string; platform?: string },
  metrics: Record<string, number>
): Promise<void> {
  try {
    await apiPost("/analytics/metric", { ...context, metrics });
  } catch (err) {
    console.error(`[worker] Failed to record metric:`, err);
  }
}
