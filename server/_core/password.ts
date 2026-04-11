import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();
  if (normalized.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scrypt(normalized, salt, KEY_LENGTH)) as Buffer;

  return [SCRYPT_PREFIX, salt, derivedKey.toString("hex")].join(":");
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const [prefix, salt, expectedHash] = storedHash.split(":");
  if (prefix !== SCRYPT_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password.trim(), salt, KEY_LENGTH)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, derivedKey);
}
