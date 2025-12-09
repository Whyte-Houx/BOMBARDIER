import fp from "fastify-plugin";
import { jwtVerify, createLocalJWKSet } from "jose";
import { getJWKS, initKeys } from "../crypto/keyManager.js";

export const jwksPlugin = fp(async function (fastify) {
  try {
    await initKeys();
  } catch {}

  fastify.get("/.well-known/jwks.json", async (request, reply) => {
    const json = await getJWKS();
    reply.type("application/json").send(JSON.stringify(json));
  });

  fastify.addHook("preHandler", async (request) => {
    const auth = request.headers["authorization"];
    let token: string | undefined;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token && request.method === "GET") {
      const q: any = (request.query as any) || {};
      if (typeof q.access_token === "string") token = q.access_token;
    }
    if (token) {
      try {
        const set = createLocalJWKSet(await getJWKS() as any);
        const { payload } = await jwtVerify(token, set, { issuer: "bombardier", audience: "api" });
        request.user = { id: String(payload.sub ?? ""), role: (payload as any).role ?? "viewer", sessionId: (payload as any).sessionId };
      } catch {}
    }
  });
});