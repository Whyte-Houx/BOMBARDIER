import { SignJWT } from "jose";
import { getSigningKey } from "./keyManager.js";

const issuer = "bombardier";
const audience = "api";

export async function signAccess(sub: string, role: string, sessionId: string) {
  const { privateKey, kid } = await getSigningKey();
  const jwt = await new SignJWT({ role, sessionId })
    .setProtectedHeader({ alg: "RS256", kid })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(privateKey as any);
  return jwt;
}