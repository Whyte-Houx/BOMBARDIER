/**
 * ============================================================================
 * ⚠️ JWT AUTHENTICATION SUSPENDED ⚠️
 * ============================================================================
 * 
 * STATUS: TEMPORARILY DISABLED - MOCK USER INJECTED
 * DATE: December 2024
 * 
 * This plugin currently BYPASSES all JWT verification and injects a mock
 * admin user for every request. This means:
 * 
 * - NO login required to access any endpoint
 * - ALL users have ADMIN privileges
 * - NO session validation occurs
 * 
 * TO RE-ENABLE REAL AUTHENTICATION:
 * 1. Implement actual JWT verification using jose or similar library
 * 2. Verify tokens against JWKS endpoint
 * 3. Extract user claims from validated token
 * 4. Remove mock user injection below
 * 5. Update frontend to handle 401 responses
 * 
 * See: frontend/dev-docs/api_reference.md for full documentation
 * ============================================================================
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export const jwtPlugin: FastifyPluginAsync = fp(async function (fastify) {
  fastify.addHook("preHandler", async (request, reply) => {
    // ⚠️ SUSPENDED: Mock user injection - bypasses all authentication
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