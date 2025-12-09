import { generateKeyPair, exportJWK, importPKCS8 } from "jose";
import { existsSync, readFileSync, writeFileSync } from "fs";

let keys: any[] = [];
let signingKey: any;
let activeKid: string = "dev-key";

const jwksPath = process.env.JWT_PUBLIC_JWKS_PATH || "src/crypto/public.jwks.json";
const maxKeys = Number(process.env.JWT_ROTATE_MAX_KEYS || 3);
const ttlDays = Number(process.env.JWT_KEY_TTL_DAYS || 30);

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function prune() {
  const cutoff = nowTs() - ttlDays * 24 * 3600;
  keys = keys.filter((k: any) => (k.createdAt || 0) >= cutoff);
  while (keys.length > maxKeys) keys.shift();
}

async function createPair(kid: string) {
  const pair = await generateKeyPair("RS256");
  const pub = await exportJWK(pair.publicKey);
  pub.kid = kid;
  pub.alg = "RS256";
  pub.use = "sig";
  (pub as any).createdAt = nowTs();
  return { privateKey: pair.privateKey, publicJwk: pub };
}

export async function initKeys() {
  if (signingKey) return;
  try {
    if (existsSync(jwksPath)) {
      const json = JSON.parse(readFileSync(jwksPath, "utf-8"));
      if (Array.isArray(json.keys)) keys = json.keys.map((k: any) => ({ ...k }));
    }
  } catch {}
  const pkcs8 = process.env.JWT_PRIVATE_KEY_PATH && existsSync(process.env.JWT_PRIVATE_KEY_PATH)
    ? readFileSync(process.env.JWT_PRIVATE_KEY_PATH, "utf-8")
    : process.env.JWT_PRIVATE_KEY;
  const kid = process.env.JWT_KEY_ID || activeKid;
  if (pkcs8) {
    signingKey = await importPKCS8(pkcs8, "RS256");
    const pair = await generateKeyPair("RS256");
    const pub = await exportJWK(pair.publicKey);
    pub.kid = kid;
    pub.alg = "RS256";
    pub.use = "sig";
    (pub as any).createdAt = nowTs();
    keys.push(pub);
  } else {
    const { privateKey, publicJwk } = await createPair(kid);
    signingKey = privateKey;
    keys.push(publicJwk);
  }
  activeKid = kid;
  prune();
  try {
    const data = JSON.stringify({ keys }, null, 2);
    writeFileSync(jwksPath, data, { encoding: "utf-8" });
  } catch {}
}

export async function rotateKeys() {
  await initKeys();
  const kid = String(process.env.JWT_KEY_ID || `key-${nowTs()}`);
  const { privateKey, publicJwk } = await createPair(kid);
  signingKey = privateKey;
  activeKid = kid;
  keys.push(publicJwk);
  prune();
  try {
    const data = JSON.stringify({ keys }, null, 2);
    writeFileSync(jwksPath, data, { encoding: "utf-8" });
  } catch {}
  return { kid };
}

export async function getSigningKey() {
  if (!signingKey) await initKeys();
  return { privateKey: signingKey, kid: activeKid };
}

export async function getJWKS() {
  if (!signingKey) await initKeys();
  return { keys } as any;
}