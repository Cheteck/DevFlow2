/**
 * @shell/theme — persistence + migration tests (production practice).
 * Runs against `:memory:` SQLite — never touches `data/`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import type { DatabasePort } from "@mosaix/ports-database";
import { runShellMigrations } from "../migrations.js";
import { ShellThemeMigrationProvider } from "./theme-migrations.js";
import {
  getPlatformThemeId,
  setPlatformThemeId,
  assignTheme,
  getThemeAssignment,
  listThemeAssignments,
  FALLBACK_THEME_ID,
} from "./theme-persistence.js";

function memoryDb(): DatabasePort {
  return new SQLiteDatabaseAdapter(":memory:");
}

async function migratedDb(): Promise<DatabasePort> {
  const db = memoryDb();
  // platform_settings DDL is legacy bootstrap-owned (pre-existing installs);
  // new tables arrive exclusively through the migration engine.
  await db.execute(
    `CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  );
  await runShellMigrations(db);
  return db;
}

describe("ShellThemeMigrationProvider", () => {
  it("declares a canonical id and sqlite-compiled up/down bodies", () => {
    const provider = new ShellThemeMigrationProvider();
    expect(provider.ownerId()).toBe("shell");
    const [migration] = provider.migrations();
    expect(migration).toBeDefined();
    expect(migration?.id).toBe("shell.theme.v1.001_create_theme_assignments");
    expect(migration?.content).toContain("theme_assignments");
    expect(migration?.content).toContain("uq_theme_assignments_target");
    expect(migration?.down).toContain("theme_assignments");
    expect(migration?.checksum.length).toBeGreaterThan(0);
  });
});

describe("runShellMigrations", () => {
  it("applies once, then plans nothing (ledger-tracked, idempotent)", async () => {
    const db = memoryDb();
    const first = await runShellMigrations(db);
    expect(first.applied).toContain(
      "shell.theme.v1.001_create_theme_assignments",
    );
    const second = await runShellMigrations(db);
    expect(second.applied).toEqual([]);
  });
});

describe("platform theme persistence", () => {
  let db: DatabasePort;
  beforeEach(async () => {
    db = await migratedDb();
  });

  it("falls back to mosaix-default when nothing is stored", async () => {
    await expect(getPlatformThemeId(db)).resolves.toBe(FALLBACK_THEME_ID);
  });

  it("persists and reads back a known theme", async () => {
    await setPlatformThemeId("ocean", db);
    await expect(getPlatformThemeId(db)).resolves.toBe("ocean");
  });

  it("rejects malformed and unknown theme ids", async () => {
    await expect(setPlatformThemeId("../../etc", db)).rejects.toThrow(
      /invalid theme id/,
    );
    await expect(setPlatformThemeId("ghost-theme", db)).rejects.toThrow(
      /unknown theme/,
    );
  });

  it("falls back when the stored value is stale (theme removed)", async () => {
    await db.execute(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      ["platform_theme_id", "deleted-theme", new Date().toISOString()],
    );
    await expect(getPlatformThemeId(db)).resolves.toBe(FALLBACK_THEME_ID);
  });
});

describe("entity theme assignments (V2.3)", () => {
  let db: DatabasePort;
  beforeEach(async () => {
    db = await migratedDb();
  });

  it("assigns, reads and lists with upsert semantics", async () => {
    await assignTheme("space", "space-design", "forest", {}, db);
    await assignTheme("space", "space-dev", "ocean", { mode: "dark" }, db);
    // Upsert: same target reassigned.
    await assignTheme("space", "space-design", "midnight", {}, db);

    const one = await getThemeAssignment("space", "space-design", db);
    expect(one?.themeId).toBe("midnight");
    const two = await getThemeAssignment("space", "space-dev", db);
    expect(two?.themeId).toBe("ocean");
    expect(two?.mode).toBe("dark");
    await expect(getThemeAssignment("space", "nope", db)).resolves.toBeUndefined();

    const all = await listThemeAssignments(db);
    expect(all.map((a) => `${a.targetType}:${a.targetId}`)).toEqual([
      "space:space-design",
      "space:space-dev",
    ]);
  });

  it("rejects unknown themes and invalid targets", async () => {
    await expect(assignTheme("space", "x", "ghost", {}, db)).rejects.toThrow(
      /unknown theme/,
    );
    await expect(assignTheme("sp ace", "x", "ocean", {}, db)).rejects.toThrow(
      /invalid assignment target/,
    );
  });
});
