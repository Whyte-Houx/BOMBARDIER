import { FastifyPluginAsync } from "fastify";
import { subscribe } from "../lib/events.js";
import type { FastifyRequest } from "fastify";

export const trackingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stream", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("analytics.read")(request, reply);
    if (!permitted) return;
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.write(":ok\n\n");
    const intervalMs = Number((request.query as any)?.intervalMs || 0);
    if (intervalMs > 0) {
      let latest: any | undefined;
      const unsubscribe = subscribe((event) => { latest = event; });
      const timer = setInterval(() => {
        if (!latest) return;
        try {
          reply.raw.write(`event: update\n`);
          reply.raw.write(`data: ${JSON.stringify(latest)}\n\n`);
          latest = undefined;
        } catch {}
      }, Math.max(200, intervalMs));
      request.raw.on("close", () => { clearInterval(timer); unsubscribe(); });
    } else {
      const unsubscribe = subscribe((event) => {
        try {
          reply.raw.write(`event: update\n`);
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {}
      });
      request.raw.on("close", () => { unsubscribe(); });
    }
  });

  (fastify as any).get("/ws", { websocket: true }, async (connection: any, request: FastifyRequest) => {
    const guard = await (fastify as any).requirePermission("analytics.read")(request as any, {
      code: (_: number) => ({ send: (_payload: any) => { try { (connection as any).socket.close(1008, "FORBIDDEN"); } catch {} } })
    });
    if (!guard) return;
    const unsubscribe = subscribe((event) => {
      try { connection.socket.send(JSON.stringify(event)); } catch {}
    });
    connection.socket.on("close", () => unsubscribe());
    connection.socket.on("message", (msg: any) => {
      // no-op: clients may send pings or filters later
      try { if (String(msg) === "ping") connection.socket.send("pong"); } catch {}
    });
  });
};