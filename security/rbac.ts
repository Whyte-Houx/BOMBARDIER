import { readFileSync } from "fs";

type Role = "admin" | "operator" | "viewer";
type Permission = string;
type User = { id: string; role: Role; permissions?: Permission[] };
type Context = { user?: User; resource?: { ownerId?: string } };
type Next = () => Promise<void>;

const path = process.env.RBAC_CONFIG_PATH || "config/rbac/permissions.json";
const catalog = JSON.parse(readFileSync(path, "utf-8"));

function resolvePermissions(user: User): Permission[] {
  if (!user) return [];
  const rolePerms = catalog.roles[user.role] || [];
  if (rolePerms.includes("*")) return catalog.permissions;
  const custom = user.permissions || [];
  const set = new Set([...rolePerms, ...custom]);
  return Array.from(set);
}

export function hasPermission(user: User | undefined, permission: Permission): boolean {
  if (!user) return false;
  const perms = resolvePermissions(user);
  return perms.includes(permission);
}

export function requirePermission(permission: Permission) {
  return async function guard(ctx: Context, next: Next) {
    const allowed = hasPermission(ctx.user, permission);
    if (!allowed) throw Object.assign(new Error("FORBIDDEN"), { code: 403, missingPermissions: [permission] });
    await next();
  };
}