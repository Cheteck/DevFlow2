/**
 * @mosaix/dev-server — secret redaction guard.
 *
 * .env files may hold secrets. This module is the single choke point used
 * before anything reaches the timeline, logs, errors or diagnostics.
 *
 * Rules: never print values, only variable NAMES. Any `KEY=value` or
 * `KEY: value` shaped text is reduced to `KEY=<redacted>`.
 */

const ENV_KEY_PATTERN =
  /\b([A-Z][A-Z0-9_]{2,})\s*([=:])\s*("[^"\n]*"|'[^'\n]*'|[^\s,;"']+)/g;

/** `sensitiveKey = value` (any case) — always a secret by name. */
const SENSITIVE_KEY_PATTERN =
  /\b([A-Za-z0-9_]*?(?:SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE_KEY|APP_KEY|API_KEY|WEBHOOK_SECRET|CREDENTIAL|SESSION_SECRET|JWT)[A-Za-z0-9_]*)\s*([=:])\s*("[^"\n]*"|'[^'\n]*'|[^\s,;"']+)/gi;

/** `Bearer <token>` / `Basic <blob>` authorization material. */
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/=]{8,}/gi;

/** Keys whose bare value on the same line must always be hidden. */
const SENSITIVE_HINTS = [
  "SECRET",
  "PASSWORD",
  "PASSWD",
  "TOKEN",
  "PRIVATE_KEY",
  "APP_KEY",
  "API_KEY",
  "WEBHOOK",
  "CREDENTIAL",
  "SESSION",
  "JWT",
];

export function containsSensitiveHint(text: string): boolean {
  const upper = text.toUpperCase();
  return SENSITIVE_HINTS.some((hint) => upper.includes(hint));
}

/** Redact `KEY=value` pairs, keeping only the variable name. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return (
    text
      // 1. Named secrets in any case (`token=abc`, `SESSION_SECRET=x`).
      .replace(SENSITIVE_KEY_PATTERN, (_m, key: string) => `${key}=<redacted>`)
      // 2. ALL-CAPS env-style pairs (values are secrets by default).
      .replace(ENV_KEY_PATTERN, (_m, key: string) => `${key}=<redacted>`)
      // 3. Bearer/Basic authorization material.
      .replace(BEARER_PATTERN, (_m, scheme: string) => `${scheme} <redacted>`)
  );
}

/**
 * Summarize an env-file change using NAMES only. Input lines are expected
 * as raw file lines; values are never echoed back.
 */
export function summarizeEnvNames(lines: string[]): string[] {
  const names = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*=/);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}
