const CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

/** Cryptographically random password for admin-facing "generate password" actions. */
export function randomPassword(length = 16): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => CHARSET[v % CHARSET.length]).join("");
}
