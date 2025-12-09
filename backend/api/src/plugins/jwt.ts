import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export const jwtPlugin: FastifyPluginAsync = fp(async function (fastify) {
  fastify.addHook("preHandler", async (request, reply) => {
    // Inject mock user for local testing
    (request as any).user = {
      id: "1",
      role: "admin",
      permissions: [],
      sessionId: "mock-session"
    };
    return;
  });
});

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: "admin" | "operator" | "viewer"; permissions?: string[]; sessionId?: string };
  }
}