/**
 * @shell/seeders — CLI-only migrate + seed flow (Laravel `migrate --seed`).
 * Runs against `:memory:` SQLite — never touches `data/`.
 *
 * Guards the doctrine: boot connects + verifies, the CLI migrates + seeds.
 */
import { describe, it, expect } from "vitest";
import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import type { DatabasePort } from "@mosaix/ports-database";
import { applySqlitePragmas } from "@mosaix/database";
import {
  runShellMigrations,
  getPendingMigrationIds,
} from "../migrations.js";
import { runDatabaseSeeds } from "./database-seeder.js";

async function freshDb(): Promise<DatabasePort> {
  const db = new SQLiteDatabaseAdapter(":memory:");
  await applySqlitePragmas(db);
  return db;
}

describe("migrate + seed flow (CLI-only)", () => {
  it("reports pending on fresh db, migrates, then verifies clean", async () => {
    const db = await freshDb();
    const pendingBefore = await getPendingMigrationIds(db);
    expect(pendingBefore).toContain("shell.core.v1.001_create_core_tables");
    expect(pendingBefore).toContain("shell.theme.v1.001_create_theme_assignments");

    const migrated = await runShellMigrations(db);
    expect(migrated.applied).toHaveLength(2);

    await expect(getPendingMigrationIds(db)).resolves.toEqual([]);
  });

  it("seeds baseline data once, then skips (idempotent)", async () => {
    const db = await freshDb();
    await runShellMigrations(db);

    const seeded = await runDatabaseSeeds(db);
    expect(seeded).toContain("shell_feed");
    expect(seeded).toContain("commerce_products");

    const feed = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM shell_feed`,
    );
    expect(feed[0]?.count).toBe(3);

    await expect(runDatabaseSeeds(db)).resolves.toEqual([]);
  });
});
