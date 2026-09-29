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
import { runShellMigrations, getPendingMigrationIds } from "../migrations.js";
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
    expect(pendingBefore).toContain(
      "shell.core.v1.002_create_subscription_tables",
    );
    expect(pendingBefore).toContain("shell.core.v1.004_drop_shell_feed");
    expect(pendingBefore).toContain(
      "shell.theme.v1.001_create_theme_assignments",
    );
    expect(pendingBefore).toContain(
      "shell.mobile.v1.001_create_mobile_bridge_tables",
    );
    expect(pendingBefore).toContain(
      "shell.features.v1.001_create_feature_flags_table",
    );

    const migrated = await runShellMigrations(db);
    expect(migrated.applied).toHaveLength(6);

    await expect(getPendingMigrationIds(db)).resolves.toEqual([]);
  });

  it("seeds baseline data once, then skips (idempotent)", async () => {
    const db = await freshDb();
    await runShellMigrations(db);

    const seeded = await runDatabaseSeeds(db);
    // shell_feed retired (N1 cutover, dropped by shell.core.v1.004): no feed seeds.
    expect(seeded).not.toContain("shell_feed");
    expect(seeded).toContain("commerce_products");

    const products = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM commerce_products`,
    );
    expect(products[0]?.count).toBe(4);

    await expect(runDatabaseSeeds(db)).resolves.toEqual([]);
  });

  it("refuses to seed when demo mode is off (MOSAIX_DEMO_USERS=false)", async () => {
    const db = await freshDb();
    await runShellMigrations(db);
    const prev = process.env.MOSAIX_DEMO_USERS;
    process.env.MOSAIX_DEMO_USERS = "false";
    try {
      await expect(runDatabaseSeeds(db)).rejects.toThrow(/demo mode is off/);
      const products = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM commerce_products`,
      );
      expect(Number(products[0]?.count ?? 0)).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.MOSAIX_DEMO_USERS;
      else process.env.MOSAIX_DEMO_USERS = prev;
    }
  });
});
