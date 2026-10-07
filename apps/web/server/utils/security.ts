import { createHash, scrypt as nodeScrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const hexPattern = /^[0-9a-f]+$/i;
const derivedKeyHexLength = 128;
const apiTokenPattern = /^wa_[\w-]{43}$/;
const bearerPattern = /^Bearer\s+(\S+)\s*$/i;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }

  if (key.length !== derivedKeyHexLength || !hexPattern.test(key)) {
    return false;
  }

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(storedKey, derivedKey);
}

// Tokens carry 256 random bits, so a fast hash is enough; scrypt only earns its cost on guessable passwords.
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiToken() {
  const token = `wa_${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, 11), tokenHash: hashApiToken(token) };
}

export function isApiTokenFormat(value: string): boolean {
  return apiTokenPattern.test(value);
}

export function parseBearerToken(authorization: string | undefined): string | null {
  return authorization?.match(bearerPattern)?.[1] ?? null;
}
