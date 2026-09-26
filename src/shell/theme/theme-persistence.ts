/**
 * @shell/theme — Theme choice persistence (production practice).
 *
 * Two levels, per the V2.3 doctrine:
 * - platform default: `platform_settings` row `platform_theme_id`
 *   (admin choice, survives restarts, read at boot);
 * - entity assignments: `theme_assignments` table (created by the
 *   `shell.theme.v1.001_create_theme_assignments` migration, never by
 *   ad-hoc DDL), resolved entity-first when per-request resolution is wired.
 *
 * All functions accept an optional `DatabasePort` (default: the shell SQLite
 * adapter) so tests run against `:memory:` without touching `data/`.
 */
import type { DatabasePort } from "@mosaix/ports-database";
import { ThemeDiscovery } from "@mosaix/core";
import * as path from "node:path";
import { initDatabase } from "../database-bootstrap.js";
import { setActiveThemeId, getActiveThemeId } from "./theme-bridge.js";

export const PLATFORM_THEME_KEY = "platform_theme_id";
export const FALLBACK_THEME_ID = "mosaix-default";

const THEME_ID_PATTERN = /^[a-z0-9-]+$/i;

function defaultDb(): DatabasePort {
  return initDatabase().dbAdapter;
}

function isKnownThemeId(id: string): boolean {
  try {
    const discovered = ThemeDiscovery.discoverThemes(
      path.resolve(process.cwd(), "themes"),
    );
    return discovered.some((t) => t.id === id);
  } catch {
    return false;
  }
}

function assertValidThemeId(themeId: string): void {
  if (!THEME_ID_PATTERN.test(themeId)) {
    throw new Error(`[theme] invalid theme id "${themeId}"`);
  }
  if (!isKnownThemeId(themeId)) {
    throw new Error(
      `[theme] unknown theme "${themeId}" — not discovered in themes/`,
    );
  }
}

export interface ThemeAssignmentRecord {
  targetType: string;
  targetId: string;
  themeId: string;
  mode: string | null;
  source: string;
  updatedAt: string;
}

function assignmentId(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}

/** Platform default theme id (admin choice). Falls back gracefully. */
export async function getPlatformThemeId(
  db: DatabasePort = defaultDb(),
): Promise<string> {
  try {
    const rows = await db.query<{ value: string }>(
      `SELECT value FROM platform_settings WHERE key = ?`,
      [PLATFORM_THEME_KEY],
    );
    const stored = rows[0]?.value;
    if (stored && THEME_ID_PATTERN.test(stored) && isKnownThemeId(stored)) {
      return stored;
    }
    if (stored) {
      console.warn(
        `[theme] stored ${PLATFORM_THEME_KEY}="${stored}" is not a known theme — using ${FALLBACK_THEME_ID}`,
      );
    }
  } catch (err) {
    console.warn(
      "[theme] cannot read platform theme, using fallback:",
      err instanceof Error ? err.message : err,
    );
  }
  return FALLBACK_THEME_ID;
}

/** Persist the admin's platform theme choice + apply it live. */
export async function setPlatformThemeId(
  themeId: string,
  db: DatabasePort = defaultDb(),
): Promise<string> {
  assertValidThemeId(themeId);
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [PLATFORM_THEME_KEY, themeId, now],
  );
  setActiveThemeId(themeId);
  return themeId;
}

/** Apply the persisted platform theme at boot (fail-soft to default). */
export async function applyPersistedPlatformTheme(
  db: DatabasePort = defaultDb(),
): Promise<string> {
  const themeId = await getPlatformThemeId(db);
  try {
    setActiveThemeId(themeId);
  } catch (err) {
    console.warn(
      "[theme] cannot activate persisted theme, using runtime default:",
      err instanceof Error ? err.message : err,
    );
  }
  return getActiveThemeId();
}

/** Entity-level assignment (V2.3: entity assigns identity). Upsert. */
export async function assignTheme(
  targetType: string,
  targetId: string,
  themeId: string,
  options: { mode?: string; source?: string } = {},
  db: DatabasePort = defaultDb(),
): Promise<ThemeAssignmentRecord> {
  assertValidThemeId(themeId);
  if (!THEME_ID_PATTERN.test(targetType) || targetId.length === 0) {
    throw new Error("[theme] invalid assignment target");
  }
  const record: ThemeAssignmentRecord = {
    targetType,
    targetId,
    themeId,
    mode: options.mode ?? null,
    source: options.source ?? "platform",
    updatedAt: new Date().toISOString(),
  };
  await db.execute(
    `INSERT INTO theme_assignments (id, target_type, target_id, theme_id, mode, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET theme_id = excluded.theme_id, mode = excluded.mode, source = excluded.source, updated_at = excluded.updated_at`,
    [
      assignmentId(targetType, targetId),
      record.targetType,
      record.targetId,
      record.themeId,
      record.mode,
      record.source,
      record.updatedAt,
    ],
  );
  return record;
}

export async function getThemeAssignment(
  targetType: string,
  targetId: string,
  db: DatabasePort = defaultDb(),
): Promise<ThemeAssignmentRecord | undefined> {
  const rows = await db.query<{
    target_type: string;
    target_id: string;
    theme_id: string;
    mode: string | null;
    source: string;
    updated_at: string;
  }>(
    `SELECT target_type, target_id, theme_id, mode, source, updated_at
     FROM theme_assignments WHERE id = ?`,
    [assignmentId(targetType, targetId)],
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    targetType: row.target_type,
    targetId: row.target_id,
    themeId: row.theme_id,
    mode: row.mode,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export async function listThemeAssignments(
  db: DatabasePort = defaultDb(),
): Promise<ThemeAssignmentRecord[]> {
  const rows = await db.query<{
    target_type: string;
    target_id: string;
    theme_id: string;
    mode: string | null;
    source: string;
    updated_at: string;
  }>(
    `SELECT target_type, target_id, theme_id, mode, source, updated_at
     FROM theme_assignments ORDER BY target_type ASC, target_id ASC`,
  );
  return rows.map((row) => ({
    targetType: row.target_type,
    targetId: row.target_id,
    themeId: row.theme_id,
    mode: row.mode,
    source: row.source,
    updatedAt: row.updated_at,
  }));
}
