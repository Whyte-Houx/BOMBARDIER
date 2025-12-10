/**
 * ============================================================================
 * ⚠️ RBAC NOTE: AUTHENTICATION SUSPENDED ⚠️
 * ============================================================================
 * 
 * STATUS: FUNCTIONAL BUT INEFFECTIVE
 * DATE: December 2024
 * 
 * This RBAC plugin is fully functional, but because authentication is
 * suspended (see plugins/jwt.ts), ALL requests receive a mock admin user.
 * 
 * This means:
 * - All permission checks PASS (admin has "*" wildcard)
 * - No real access control is enforced
 * 
 * When authentication is re-enabled, RBAC will work as designed with
 * proper role-based access control.
 * 
 * See: config/rbac/permissions.json for role definitions
 * ============================================================================
 */

import fp from "fastify-plugin";
import { readFileSync } from "fs";
const configPath = process.env.RBAC_CONFIG_PATH || "config/rbac/permissions.json";
const catalog = JSON.parse(readFileSync(configPath, "utf-8"));

function hasPermission(user: any, permission: string): boolean {
  if (!user) return false;
  const rolePerms: string[] = catalog.roles[user.role] || [];
  const perms = new Set<string>([...rolePerms, ...(user.permissions || [])]);
  if (rolePerms.includes("*")) catalog.permissions.forEach((p: string) => perms.add(p));
  return perms.has(permission);
}

export const rbacPlugin = fp(async function (fastify) {
  fastify.decorate("requirePermission", function (permission: string) {
    return async function (request: any, reply: any) {
      const user = request.user;
      const allowed = hasPermission(user, permission);
      if (!allowed) {
        reply.code(403).send({ error: "FORBIDDEN", missingPermissions: [permission] });
        return false;
      }
      return true;
    };
  });
});