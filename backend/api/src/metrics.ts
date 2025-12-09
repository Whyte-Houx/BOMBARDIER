import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpHistogram = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  labelNames: ["route", "method"]
});

export const jobsEnqueued = new client.Counter({
  name: "jobs_enqueued_total",
  help: "Jobs enqueued",
  labelNames: ["queue"]
});

registry.registerMetric(httpHistogram);
registry.registerMetric(jobsEnqueued);

export const queueSize = new client.Gauge({
  name: "queue_size",
  help: "Redis queue size",
  labelNames: ["queue"]
});

export const workerProcessed = new client.Gauge({
  name: "worker_processed_total",
  help: "Total items processed by workers (from Redis counters)",
  labelNames: ["queue"]
});

export const workerErrors = new client.Gauge({
  name: "worker_errors_total",
  help: "Total errors encountered by workers (from Redis counters)",
  labelNames: ["queue"]
});

export const httpErrors = new client.Counter({
  name: "http_errors_total",
  help: "HTTP errors",
  labelNames: ["route", "code"]
});

registry.registerMetric(queueSize);
registry.registerMetric(workerProcessed);
registry.registerMetric(workerErrors);
registry.registerMetric(httpErrors);