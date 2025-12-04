import crypto from "crypto";

/**
 * Hashes a password using SHA-256
 */
export function hashPassword(
  password: string | null | undefined
): string | null {
  if (!password) return null;
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Verifies if a password matches the stored hash
 */
export function verifyPassword(
  password: string | null | undefined,
  hash: string | null
): boolean {
  if (!password || !hash) return false;
  const inputHash = hashPassword(password);
  return inputHash === hash;
}
