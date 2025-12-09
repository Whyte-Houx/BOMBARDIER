import { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import argon2 from "argon2";
import { signAccess } from "../crypto/tokens.js";
import { getRedis, setWithTTL, getKey, delKey } from "../lib/redis.js";
import { UserRepo } from "../repos.js";
import { rotateKeys } from "../crypto/keyManager.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/register", async (request: any, reply: any) => {
    const { email, password, username } = request.body as any;
    if (!email || !password || !username || String(password).length < 12) { reply.code(400).send({ error: "WEAK_OR_MISSING_FIELDS" }); return; }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      const user = await UserRepo.create({ email, username, passwordHash, role: "viewer" });
      reply.code(201).send({ id: String((user as any)._id), email, username });
    } catch (e) {
      reply.code(409).send({ error: "USER_EXISTS" });
    }
  });
  fastify.post("/login", async (request: any, reply: any) => {
    const { email, password } = request.body as any;
    const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
    const lockKey = `login:lock:${email}`;
    const attemptsKey = `login:attempts:${email}`;
    if (await getKey(lockKey)) { reply.code(429).send({ error: "LOCKED" }); return; }
    const user = await UserRepo.findByEmail(email);
    if (!user) { reply.code(401).send({ error: "INVALID_CREDENTIALS" }); return; }
    let ok = false;
    const hashVal = String(user.passwordHash || "");
    if (hashVal.startsWith("$argon2id$")) {
      try { ok = await argon2.verify(hashVal, password); } catch { ok = false; }
    } else {
      const parts = hashVal.split(":");
      const algo = parts[0];
      const salt = parts[1];
      const stored = parts[2];
      if (algo !== "scrypt" || !salt || !stored) { reply.code(500).send({ error: "UNSUPPORTED_HASH" }); return; }
      const hashBuf = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, 64, (err, derivedKey) => err ? reject(err) : resolve(derivedKey as Buffer)));
      ok = crypto.timingSafeEqual(Buffer.from(stored, "hex"), hashBuf);
    }
    if (!ok) {
      const current = Number(await getKey(attemptsKey)) || 0;
      const next = current + 1;
      await setWithTTL(attemptsKey, String(next), 15 * 60);
      if (next >= 10) await setWithTTL(lockKey, "1", 10 * 60);
      reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      return;
    }
    await delKey(attemptsKey);
    const sessionId = crypto.randomBytes(16).toString("hex");
    const refresh = crypto.randomBytes(32).toString("hex");
    const refreshHash = crypto.createHash("sha256").update(refresh).digest("hex");
    await setWithTTL(`session:${sessionId}`, refreshHash, 30 * 24 * 3600);
    const token = await signAccess(String((user as any)._id), String(user.role || "viewer"), sessionId);
    reply
      .setCookie("refresh_token", refresh, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 3600,
      })
      .code(200)
      .send({ token, user: { id: String((user as any)._id), role: String(user.role || "viewer") } });
  });
  fastify.post("/refresh", async (request: any, reply: any) => {
    const refresh: string | undefined = (request.cookies as any)?.refresh_token;
    const auth = request.headers["authorization"];
    const oldSessionId = typeof auth === "string" && auth.startsWith("Bearer ") ? (request.user as any)?.sessionId : undefined;
    if (!refresh || !oldSessionId) { reply.code(400).send({ error: "MISSING_REFRESH_OR_SESSION" }); return; }
    const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
    const stored = await getKey(`session:${oldSessionId}`);
    if (!stored) { reply.code(401).send({ error: "SESSION_INVALID" }); return; }
    const refreshHash = crypto.createHash("sha256").update(refresh).digest("hex");
    if (stored !== refreshHash) { reply.code(401).send({ error: "REFRESH_INVALID" }); return; }
    await delKey(`session:${oldSessionId}`);
    const sessionId = crypto.randomBytes(16).toString("hex");
    const newRefresh = crypto.randomBytes(32).toString("hex");
    const newHash = crypto.createHash("sha256").update(newRefresh).digest("hex");
    await setWithTTL(`session:${sessionId}`, newHash, 30 * 24 * 3600);
    const sub = String((request.user as any)?.id || "");
    const role = String((request.user as any)?.role || "viewer");
    const token = await signAccess(sub, role, sessionId);
    reply
      .setCookie("refresh_token", newRefresh, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600 })
      .code(200)
      .send({ token });
  });
  fastify.post("/logout", async (request: any, reply: any) => {
    const sessionId = (request.user as any)?.sessionId;
    if (sessionId) await delKey(`session:${sessionId}`);
    reply.clearCookie("refresh_token", { path: "/" }).code(204).send();
  });
  fastify.post("/revoke", async (request: any, reply: any) => {
    const { sessionId } = request.body as any;
    if (!sessionId) { reply.code(400).send({ error: "MISSING_SESSION" }); return; }
    await delKey(`session:${sessionId}`);
    reply.code(204).send();
  });
  fastify.get("/me", async (request: any, reply: any) => {
    if (!request.user) { reply.code(401).send({ error: "UNAUTHENTICATED" }); return; }
    reply.code(200).send({ user: request.user });
  });
  fastify.post("/keys/rotate", async (request: any, reply: any) => {
    const permitted = await (fastify as any).requirePermission("system.write")(request, reply);
    if (!permitted) return;
    const res = await rotateKeys();
    reply.code(200).send({ kid: res.kid });
  });
};