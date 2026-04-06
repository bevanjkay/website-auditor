import { scrypt as nodeScrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const hexPattern = /^[0-9a-f]+$/i;
const derivedKeyHexLength = 128;

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
