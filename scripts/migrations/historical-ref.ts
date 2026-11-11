/**
 * scripts/migrations/historical-ref.ts — the reference of the audits.
 *
 * The audits compare the TypeScript native migrations with the historical
 * SQL migrations they replaced. That reference must be **pinned**: once the
 * conversion is committed, `HEAD` carries the TypeScript version and the
 * comparison would trivially succeed.
 *
 * `8507d6d` is the last revision that still carried the historical SQL
 * migrations (the `content` / `rawSql` form). The migrations created by the
 * conversion itself do not exist there: they are skipped by the audits
 * (nothing to compare against).
 */
export const HISTORICAL_REF = "8507d6d";

/** The historical source of a migration file, or `undefined` if it had none. */
export function historicalSource(
  file: string,
  readFile: (ref: string, path: string) => string | undefined,
): string | undefined {
  return readFile(HISTORICAL_REF, file);
}
