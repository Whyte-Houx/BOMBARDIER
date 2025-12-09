import crypto from "crypto";

// Ensure key is valid 32-byte hex or generate hash if password provided
function normalizeKey(key: string): Buffer {
  if (!key) {
    throw new Error("Encryption key is missing");
  }

  // If we have exactly 64 hex chars (32 bytes hex encoded), usage it directly
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // Otherwise verify if it's 32 bytes binary (rare in string env vars) or just fallback to hashing
  // For safety, let's always hash if it doesn't look like a proper hex key, 
  // ensuring we always get 32 bytes.
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(text: string, key: string) {
  const normKey = normalizeKey(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", normKey, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string, key: string) {
  const normKey = normalizeKey(key);
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", normKey, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}