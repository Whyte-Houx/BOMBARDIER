/**
 * JWT Authentication Plugin
 * 
 * Supports two modes:
 * 1. PRODUCTION MODE: Real JWT verification using jose library
 * 2. DEVELOPMENT MODE: Mock admin user injection (for local testing)
 * 
 * Environment Variables:
 * - AUTH_DISABLED=true  : Disables authentication (injects mock admin)
 * - JWT_SECRET          : Secret for HS256 JWT signing (required in production)
 * - NODE_ENV=production : Enforces real authentication
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import * as jose from "jose";

// Internal API key for worker-to-API communication
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "bombardier-internal-key-dev";

// Check if authentication is disabled
const isAuthDisabled = (): boolean => {
  // Never disable auth in production unless explicitly set
  if (process.env.NODE_ENV === "production" && process.env.AUTH_DISABLED !== "true") {
    return false;
  }
  return process.env.AUTH_DISABLED === "true";
};

// Get JWT secret
const getJwtSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
};

export const jwtPlugin: FastifyPluginAsync = fp(async function (fastify) {
  // Decorate request with user property
  fastify.decorateRequest("user", null);

  // Add internal API key verification helper
  fastify.decorate("verifyInternalApiKey", function (request: FastifyRequest): boolean {
    const apiKey = request.headers["x-api-key"] || request.headers["x-internal-key"];
    return apiKey === INTERNAL_API_KEY;
  });

  // Pre-handler hook for JWT verification
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for certain public paths
    const publicPaths = [
      "/health",
      "/metrics",
      "/auth/register",
      "/auth/login",
      "/oauth"
    ];

    const path = request.url;
    if (publicPaths.some(p => path.startsWith(p))) {
      return;
    }

    // Development mode: inject mock admin user
    if (isAuthDisabled()) {
      (request as any).user = {
        id: "mock-admin-001",
        role: "admin" as const,
        permissions: [],
        sessionId: "mock-session",
        isMock: true
      };
      return;
    }

    // Production mode: verify JWT
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Check for internal API key (for worker requests)
      if ((fastify as any).verifyInternalApiKey(request)) {
        (request as any).user = {
          id: "internal-worker",
          role: "admin" as const,
          permissions: ["*"],
          sessionId: "internal",
          isInternal: true
        };
        return;
      }

      reply.code(401).send({ error: "UNAUTHENTICATED", message: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const { payload } = await jose.jwtVerify(token, getJwtSecret(), {
        algorithms: ["HS256"]
      });

      (request as any).user = {
        id: payload.sub || payload.userId,
        role: payload.role || "viewer",
        permissions: payload.permissions || [],
        sessionId: payload.sessionId
      };
    } catch (err) {
      fastify.log.warn({ err }, "JWT verification failed");
      reply.code(401).send({ error: "INVALID_TOKEN", message: "Token verification failed" });
      return;
    }
  });
});

// Helper to sign access tokens
export async function signAccessToken(userId: string, role: string, sessionId: string): Promise<string> {
  const secret = getJwtSecret();
  const token = await new jose.SignJWT({
    sub: userId,
    role,
    sessionId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return token;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      role: "admin" | "operator" | "viewer";
      permissions?: string[];
      sessionId?: string;
      isMock?: boolean;
      isInternal?: boolean;
    };
  }
  interface FastifyInstance {
    verifyInternalApiKey(request: FastifyRequest): boolean;
  }
}