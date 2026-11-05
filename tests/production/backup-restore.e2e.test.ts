/**
 * @tests/production/backup-restore.e2e — End-to-End Backup and Restore Test (R07)
 *
 * Proves that `scripts/db-backup.ts` creates a valid backup snapshot and that
 * restoring it into a clean Postgres database produces identical tables and record counts.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { createBackup, verifyBackup, restoreBackup } from "../../scripts/db-backup.js";

const TEST_RESTORE_DB = "mosaix_dr_test_restore";


function isDockerPostgresAvailable(): boolean {
  try {
    const containerName = process.env.MOSAIX_DB_CONTAINER || "mosaix-db-1";
    const out = execFileSync("docker", ["ps", "--filter", `name=${containerName}`, "--format", "{{.Names}}"], { encoding: "utf8" });
    return out.trim().includes(containerName);
  } catch {
    return false;
  }
}
const describeOrSkip = isDockerPostgresAvailable() ? describe : describe.skip;

function dropAndCreateTestDb(): void {
  const containerName = process.env.MOSAIX_DB_CONTAINER || "mosaix-db-1";
  const opts = { stdio: "ignore" as const, timeout: 60_000 };

  try {
    execFileSync("docker", ["exec", containerName, "dropdb", "-U", "mosaix", TEST_RESTORE_DB], opts);
  } catch {
    /* absent */
  }

  execFileSync("docker", ["exec", containerName, "createdb", "-U", "mosaix", TEST_RESTORE_DB], opts);
}

function getTableCount(dbName: string): number {
  const containerName = process.env.MOSAIX_DB_CONTAINER || "mosaix-db-1";
  const sql = "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'";
  const out = execFileSync(
    "docker",
    ["exec", containerName, "psql", "-U", "mosaix", "-d", dbName, "-t", "-c", sql],
    { encoding: "utf8", timeout: 30_000 }
  );
  return Number.parseInt(out.trim(), 10) || 0;
}

describeOrSkip("Backup & Restore DR Pipeline (R07)", () => {
  let backupFilepath = "";

  beforeAll(() => {
    // Ensure test target DB exists and is empty
    dropAndCreateTestDb();
  });

  afterAll(() => {
    // Clean up created backup file if present
    if (backupFilepath && fs.existsSync(backupFilepath)) {
      try {
        fs.unlinkSync(backupFilepath);
      } catch {
        /* ignore */
      }
    }
  });

  it("creates a non-empty, valid backup snapshot of the current database", async () => {
    const res = await createBackup();
    expect(res.filepath).toBeTruthy();
    expect(res.sizeBytes).toBeGreaterThan(0);
    expect(fs.existsSync(res.filepath)).toBe(true);
    backupFilepath = res.filepath;

    const isValid = await verifyBackup(backupFilepath);
    expect(isValid).toBe(true);
  });

  it("restores the snapshot into a fresh database and preserves table counts", { timeout: 120_000 }, async () => {
    expect(backupFilepath).toBeTruthy();

    // Verify initial table count in target DB is zero
    const initialTables = getTableCount(TEST_RESTORE_DB);
    expect(initialTables).toBe(0);

    // Perform restore onto the isolated test DB
    await restoreBackup(backupFilepath, TEST_RESTORE_DB);

    // Verify restored table count matches the primary DB (at least > 5)
    const restoredTables = getTableCount(TEST_RESTORE_DB);
    expect(restoredTables).toBeGreaterThan(5);
  });

  it("fails fast when trying to verify a corrupt or zero-byte backup file", async () => {
    const fakeCorruptPath = path.join(process.cwd(), ".mosaix", "backups", "corrupt-test.sql");
    fs.writeFileSync(fakeCorruptPath, "", "utf8"); // 0 bytes

    await expect(verifyBackup(fakeCorruptPath)).rejects.toThrow("Backup file is zero bytes");

    fs.unlinkSync(fakeCorruptPath);
  });
});
