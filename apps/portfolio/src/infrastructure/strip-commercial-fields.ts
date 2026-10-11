/**
 * @apps/portfolio — one-shot commercial-field strip (PIM purity).
 *
 * Implements responsibilities.md § "Écarts cible-vs-réel" (A3) :
 * historical `variants[].pricing / variants[].inventory` payloads persisted as JSON
 * are extracted into the archive table (backup + source for the
 * future Commerce offers / Inventory referential) and stripped from the rows.
 * (`portfolio.commercial_archive` on Postgres, `portfolio_commercial_archive` on SQLite.)
 *
 * - Dry-run by default (`apply: false`) : scans and reports, writes nothing.
 * - Apply mode runs inside a single `DatabasePort.transaction` : archive table
 *   creation, archive inserts and variants updates are atomic (rollback on throw).
 * - Missing source table (e.g. SQLite boot without BAC providers)
 *   is reported as a zero-scan, not an error.
 */

import { randomUUID } from "node:crypto";
import type { DatabasePort } from "@mosaix/ports-database";

export interface ArchivedCommercialPayload {
  archiveId: string;
  vendableId: string;
  variantId: string | null;
  payload: { pricing?: unknown; inventory?: unknown };
}

export interface StripCommercialReport {
  applied: boolean;
  tableFound: boolean;
  vendablesScanned: number;
  variantsScanned: number;
  variantsStripped: number;
  archived: ArchivedCommercialPayload[];
}

function asVariantsArray(value: unknown): Array<Record<string, unknown>> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (v): v is Record<string, unknown> =>
      typeof v === "object" && v !== null,
  );
}

export async function stripCommercialFields(
  db: DatabasePort,
  opts?: { apply?: boolean },
): Promise<StripCommercialReport> {
  const apply = opts?.apply === true;
  // Schema isolation (v1.003) is Postgres-only; SQLite keeps unqualified names.
  const qualified = db.capabilities.dialect === "postgres";
  const sourceTable = qualified ? `"portfolio"."vendables"` : "portfolio_vendables";
  const archiveTable = qualified ? `"portfolio"."commercial_archive"` : "portfolio_commercial_archive";

  let rows: Array<Record<string, unknown>>;
  try {
    rows = await db.query<Record<string, unknown>>(
      `SELECT id, variants FROM ${sourceTable}`,
    );
  } catch {
    return {
      applied: false,
      tableFound: false,
      vendablesScanned: 0,
      variantsScanned: 0,
      variantsStripped: 0,
      archived: [],
    };
  }

  const strippedRows: Array<{ id: string; variantsJson: string }> = [];
  const archived: ArchivedCommercialPayload[] = [];
  let variantsScanned = 0;

  for (const row of rows) {
    const vendableId = typeof row.id === "string" ? row.id : "";
    const variants = asVariantsArray(row.variants);
    variantsScanned += variants.length;

    let touched = false;
    const cleaned = variants.map((v) => {
      const { pricing, inventory, ...descriptive } = v;
      if (pricing !== undefined || inventory !== undefined) {
        touched = true;
        const variantId =
          typeof v.id === "string"
            ? v.id
            : typeof v.reference === "string"
              ? v.reference
              : null;
        archived.push({
          archiveId: randomUUID(),
          vendableId,
          variantId,
          payload: { pricing, inventory },
        });
      }
      return descriptive;
    });

    if (touched) {
      strippedRows.push({ id: vendableId, variantsJson: JSON.stringify(cleaned) });
    }
  }

  const report: StripCommercialReport = {
    applied: apply && strippedRows.length > 0,
    tableFound: true,
    vendablesScanned: rows.length,
    variantsScanned,
    variantsStripped: strippedRows.length,
    archived,
  };

  if (!apply || strippedRows.length === 0) {
    return { ...report, applied: false };
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS ${archiveTable} (
        id TEXT PRIMARY KEY,
        "vendableId" TEXT,
        "variantId" TEXT,
        payload TEXT,
        "createdAt" TEXT
      )`,
    );
    const createdAt = new Date().toISOString();
    for (const entry of archived) {
      await tx.execute(
        `INSERT INTO ${archiveTable} (id, "vendableId", "variantId", payload, "createdAt")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          entry.archiveId,
          entry.vendableId,
          entry.variantId,
          JSON.stringify(entry.payload),
          createdAt,
        ],
      );
    }
    for (const stripped of strippedRows) {
      await tx.execute(
        `UPDATE ${sourceTable} SET variants = $1 WHERE id = $2`,
        [stripped.variantsJson, stripped.id],
      );
    }
  });

  return { ...report, applied: true };
}
