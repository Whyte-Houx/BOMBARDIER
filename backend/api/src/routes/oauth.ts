import { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { readFileSync } from "fs";
import { encrypt } from "../crypto/aes.js";
import { UserRepo } from "../repos.js";
import { getRedis, setWithTTL, getKey, delKey } from "../lib/redis.js";
import { signAccess } from "../crypto/tokens.js";

export const oauthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/:provider/start", async (request: any, reply: any) => {
    const provider = (request.params as any).provider;
    const mode = (request.query as any)?.mode === "login" ? "login" : "link";
    const verifier = crypto.randomBytes(32).toString("hex");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(12).toString("hex");
    const cfg = JSON.parse(readFileSync("../../config/oauth/providers.json", "utf-8"))[provider];
    if (!cfg) { reply.code(404).send({ error: "UNKNOWN_PROVIDER" }); return; }
    const clientId = process.env[cfg.clientIdEnv];
    const redirectUri = process.env[cfg.redirectUriEnv];
    if (!clientId || !redirectUri) { reply.code(501).send({ error: "OAUTH_NOT_CONFIGURED" }); return; }
    const url = new URL(cfg.authUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", cfg.scope);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    try {
      const redis = await getRedis(process.env.REDIS_URL || "redis://localhost:6379");
      await setWithTTL(`oauth:state:${state}`, JSON.stringify({ verifier, provider, mode }), 10 * 60);
    } catch {}
    reply.code(200).send({ provider, state, codeVerifier: verifier, authorizeUrl: url.toString() });
  });
  fastify.get("/:provider/callback", async (request: any, reply: any) => {
    const provider = (request.params as any).provider;
    const code = (request.query as any).code;
    let codeVerifier = (request.query as any).code_verifier;
    const state = (request.query as any).state;
    if (!codeVerifier && state) {
      try {
        const json = await getKey(`oauth:state:${state}`);
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed?.verifier) codeVerifier = parsed.verifier;
        }
      } catch {}
    }
    const cfg = JSON.parse(readFileSync("../../config/oauth/providers.json", "utf-8"))[provider];
    if (!cfg) { reply.code(404).send({ error: "UNKNOWN_PROVIDER" }); return; }
    const clientId = process.env[cfg.clientIdEnv];
    const clientSecret = process.env[cfg.clientSecretEnv];
    const redirectUri = process.env[cfg.redirectUriEnv];
    if (!clientId || !clientSecret || !redirectUri) { reply.code(501).send({ error: "OAUTH_NOT_CONFIGURED" }); return; }
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);
    form.set("redirect_uri", redirectUri);
    if (codeVerifier) form.set("code_verifier", codeVerifier);
    const tokenRes = await fetch(cfg.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body: form.toString() });
    const tokenJson = await tokenRes.json();
    const refresh = tokenJson.refresh_token || tokenJson.refreshToken;
    const encKey = process.env.ENCRYPTION_KEY_HEX || "";
    let user: any | undefined;
    if (refresh && encKey) {
      const enc = encrypt(refresh, encKey);
      const authUserId = String((request.user as any)?.id || "");
      if (authUserId) {
        await UserRepo.linkOAuth(authUserId, provider, enc);
        user = { id: authUserId, role: String((request.user as any)?.role || "viewer") };
      } else {
        const created = await UserRepo.create({ email: `${provider}_${Date.now()}@example.com`, username: `${provider}_${Date.now()}`, passwordHash: "", role: "viewer", apiKeys: [{ key: enc, name: provider, permissions: [], createdAt: new Date() }] });
        user = { id: String((created as any)._id), role: "viewer" };
      }
    }
    let token: string | undefined;
    if (!request.user && user?.id) {
      token = await signAccess(user.id, user.role || "viewer", crypto.randomBytes(16).toString("hex"));
    }
    if (state) { try { await delKey(`oauth:state:${state}`); } catch {} }
    reply.code(200).send(token ? { token, user } : { ok: true });
  });
};