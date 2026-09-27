/**
 * @mosaix/support — Demo mode master switch (canonical).
 *
 * Single truth table for `MOSAIX_DEMO_USERS`, shared by the shell
 * (`src/shell/profiles.ts`) and the BACs (e.g. Citadelle mock tables) so
 * mock/demo content gating never drifts between layers. Low-level package:
 * must stay dependency-free (no shell imports).
 *
 * - Explicit `MOSAIX_DEMO_USERS` wins in any environment.
 * - Unset/empty = auto: enabled everywhere except production.
 *
 * When demo mode is OFF, all mock data, demo identities and in-memory
 * persistence fallbacks must be disabled (fail-fast or empty states).
 */
export function isDemoMode(
  source: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): boolean {
  const raw = source.MOSAIX_DEMO_USERS;
  if (raw !== undefined && raw !== "") {
    const v = raw.toLowerCase().trim();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  }
  const env = source.MOSAIX_ENV ?? source.NODE_ENV ?? "development";
  return env !== "production";
}
