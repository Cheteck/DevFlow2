import { randomBytes } from "node:crypto";

/**
 * @mosaix/config — Application key management, inspired by Laravel's `APP_KEY`.
 *
 * Laravel semantics reproduced (adapted to MosaiX naming):
 * - `generateAppKey()` → `"base64:<base64 of 32 random bytes>"` (AES-256).
 * - `parseAppKey()` validates the `base64:` prefix, decodes, and checks the
 *   byte length against the cipher (`AES-256-CBC` → 32 bytes,
 *   `AES-128-CBC` → 16 bytes). Throws fail-fast like Laravel's
 *   `MissingAppKeyException` / invalid-key errors.
 * - Rotation: `MOSAIX_APP_PREVIOUS_KEYS` (comma-separated) lets old keys keep
 *   verifying while the current key encrypts — same role as Laravel's
 *   `APP_PREVIOUS_KEYS`. `resolveKeysWithRotation()` returns
 *   `[current, ...previous]` for try-each verification.
 * - `generateSecret()` covers non-encryption secrets (JWT / session / webhook):
 *   raw hex or base64url, no prefix, minimum 256 bits by default.
 */

export const APP_KEY_PREFIX = "base64:";

export type AppCipher = "AES-256-CBC" | "AES-128-CBC";

export const APP_CIPHERS: readonly AppCipher[] = ["AES-256-CBC", "AES-128-CBC"];

export function requiredKeyBytes(cipher: AppCipher): number {
  return cipher === "AES-128-CBC" ? 16 : 32;
}

export class MissingAppKeyError extends Error {
  constructor(keyName = "MOSAIX_APP_KEY") {
    super(
      `No application encryption key has been specified (${keyName} is empty). ` +
        `Run: pnpm key:generate`,
    );
    this.name = "MissingAppKeyError";
  }
}

export class InvalidAppKeyError extends Error {
  constructor(reason: string) {
    super(`Invalid application key: ${reason}`);
    this.name = "InvalidAppKeyError";
  }
}

/** Generate a Laravel-style app key: `base64:<32 random bytes>`. */
export function generateAppKey(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new InvalidAppKeyError("byte length must be a positive integer");
  }
  return `${APP_KEY_PREFIX}${randomBytes(bytes).toString("base64")}`;
}

/** Decode a `base64:` app key to raw bytes (throws on bad format). */
export function decodeAppKey(value: string): Buffer {
  if (!value || value.length === 0) throw new MissingAppKeyError();
  if (!value.startsWith(APP_KEY_PREFIX)) {
    throw new InvalidAppKeyError(
      `expected "${APP_KEY_PREFIX}" prefix (got "${value.slice(0, 16)}…"). ` +
        `Generate one with: pnpm key:generate`,
    );
  }
  const raw = value.slice(APP_KEY_PREFIX.length);
  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    throw new InvalidAppKeyError("key is not valid base64");
  }
  if (decoded.length === 0)
    throw new InvalidAppKeyError("key decodes to empty bytes");
  // Round-trip guard against truncated/padded garbage.
  const canonical = decoded.toString("base64").replace(/=+$/, "");
  if (canonical !== raw.replace(/=+$/, "")) {
    throw new InvalidAppKeyError("key is not canonical base64");
  }
  return decoded;
}

/** Validate length against the cipher; returns decoded bytes. */
export function parseAppKey(
  value: string,
  cipher: AppCipher = "AES-256-CBC",
): Buffer {
  if (!APP_CIPHERS.includes(cipher)) {
    throw new InvalidAppKeyError(
      `unsupported cipher "${cipher}" (expected ${APP_CIPHERS.join(" | ")})`,
    );
  }
  const decoded = decodeAppKey(value);
  const expected = requiredKeyBytes(cipher);
  if (decoded.length !== expected) {
    throw new InvalidAppKeyError(
      `key is ${decoded.length} bytes but ${cipher} requires exactly ${expected} bytes`,
    );
  }
  return decoded;
}

export function isValidAppKey(
  value: string | undefined,
  cipher: AppCipher = "AES-256-CBC",
): boolean {
  if (!value) return false;
  try {
    parseAppKey(value, cipher);
    return true;
  } catch {
    return false;
  }
}

export interface SecretGenOptions {
  /** Random bytes of entropy (default 32 = 256 bits). */
  bytes?: number;
  /** `hex` (default) or `base64url`. */
  encoding?: "hex" | "base64url";
}

/** Generate a raw secret for HMAC/JWT/session/webhook usage (no prefix). */
export function generateSecret(options: SecretGenOptions = {}): string {
  const bytes = options.bytes ?? 32;
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new InvalidAppKeyError(
      "secrets require at least 16 bytes (128 bits); 32 recommended",
    );
  }
  const buf = randomBytes(bytes);
  return options.encoding === "base64url"
    ? buf.toString("base64url")
    : buf.toString("hex");
}

/** Split a comma-separated previous-keys var, dropping blanks. */
export function parsePreviousKeys(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Ordered key list for verification: current first, then previous.
 * Verifiers should try each in order (constant-time compare each) and accept
 * the first match — new tokens always use `keys[0]`.
 */
export function resolveKeysWithRotation(
  current: string | undefined,
  previous: string | string[] | undefined,
): string[] {
  const prev = Array.isArray(previous) ? previous : parsePreviousKeys(previous);
  const keys = current && current.length > 0 ? [current, ...prev] : [...prev];
  return [...new Set(keys)];
}

export interface AppKeyEnv {
  key: string | undefined;
  cipher: AppCipher;
  previousKeys: string[];
}

/** Read `MOSAIX_APP_KEY` / `MOSAIX_APP_CIPHER` / `MOSAIX_APP_PREVIOUS_KEYS` from a source. */
export function readAppKeyEnv(
  source: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): AppKeyEnv {
  const cipher = (source.MOSAIX_APP_CIPHER ?? "AES-256-CBC") as AppCipher;
  return {
    key: source.MOSAIX_APP_KEY,
    cipher: APP_CIPHERS.includes(cipher) ? cipher : "AES-256-CBC",
    previousKeys: parsePreviousKeys(source.MOSAIX_APP_PREVIOUS_KEYS),
  };
}

/** Require a valid app key (throws `MissingAppKeyError` / `InvalidAppKeyError`). */
export function requireAppKey(
  source: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): Buffer {
  const { key, cipher } = readAppKeyEnv(source);
  if (!key) throw new MissingAppKeyError();
  return parseAppKey(key, cipher);
}
