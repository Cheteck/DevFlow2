/**
 * @scripts/db-backup — Database Backup & Restore Utility (R07)
 *
 * Supports both PostgreSQL (pg_dump / pg_restore) and SQLite (file copy with WAL checkpoint).
 * Generates timestamped snapshots in `.mosaix/backups/`.
 *
 * Commands:
 *   pnpm tsx scripts/db-backup.ts              — Create a new backup
 *   pnpm tsx scripts/db-backup.ts --list        — List available backups
 *   pnpm tsx scripts/db-backup.ts --restore <f> — Restore from a backup file
 *   pnpm tsx scripts/db-backup.ts --verify <f>  — Verify backup file integrity
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { createCliApplication } from "../bootstrap/index.js";

const BACKUP_DIR = path.join(process.cwd(), ".mosaix", "backups");

function ensureBackupDir(): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export interface BackupResult {
  filepath: string;
  driver: "postgres" | "sqlite";
  sizeBytes: number;
  createdAt: string;
}

export async function createBackup(): Promise<BackupResult> {
  const app = await createCliApplication({
    skipSecurity: true,
    skipComposition: true,
  });

  const { config } = app;
  const dir = ensureBackupDir();
  const timestamp = getTimestamp();

  if (config.connection === "postgres" || config.connection === "pgsql") {
    const filename = `mosaix-backup-${timestamp}.sql`;
    const filepath = path.join(dir, filename);

    const connStr = config.connectionString;
    if (!connStr) {
      throw new Error("Missing Postgres connection string (DATABASE_URL)");
    }

    // Determine if running inside or alongside Docker
    try {
      execFileSync("pg_dump", ["--version"], { stdio: "ignore" });
      // Direct pg_dump available
      execFileSync("pg_dump", ["-d", connStr, "-f", filepath, "-F", "p", "-O", "-x"], {
        stdio: "pipe",
        timeout: 120_000,
      });
    } catch {
      // Fallback to Docker pg_dump if local CLI is missing
      const containerName = process.env.MOSAIX_DB_CONTAINER || "mosaix-db-1";
      const dbName = connStr.split("/").pop()?.split("?")[0] || "mosaix";
      const sqlContent = execFileSync(
        "docker",
        ["exec", containerName, "pg_dump", "-U", "mosaix", "-F", "p", "-O", "-x", dbName],
        { encoding: "utf8", timeout: 120_000 }
      );
      fs.writeFileSync(filepath, sqlContent, "utf8");
    }

    const stats = fs.statSync(filepath);
    if (stats.size === 0) {
      fs.unlinkSync(filepath);
      throw new Error("Backup file generated was empty — pg_dump failed");
    }

    // Create a symlink/copy as LATEST
    const latestPath = path.join(dir, "mosaix-backup-LATEST.sql");
    fs.copyFileSync(filepath, latestPath);

    return {
      filepath,
      driver: "postgres",
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };
  } else {
    // SQLite
    const dbPath = path.resolve(process.cwd(), config.database || "data/mosaix.sqlite");
    if (!fs.existsSync(dbPath)) {
      throw new Error(`SQLite database file not found: ${dbPath}`);
    }

    const filename = `mosaix-backup-${timestamp}.sqlite`;
    const filepath = path.join(dir, filename);

    // Checkpoint WAL if present
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      try {
        app.dbAdapter.execute("PRAGMA wal_checkpoint(FULL)").catch(() => {});
      } catch {
        /* ignore */
      }
    }

    fs.copyFileSync(dbPath, filepath);
    const stats = fs.statSync(filepath);

    const latestPath = path.join(dir, "mosaix-backup-LATEST.sqlite");
    fs.copyFileSync(filepath, latestPath);

    return {
      filepath,
      driver: "sqlite",
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };
  }
}

export function listBackups(): string[] {
  const dir = ensureBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("mosaix-backup-") && !f.endsWith("-LATEST.sql") && !f.endsWith("-LATEST.sqlite"))
    .sort()
    .reverse();
}

export async function verifyBackup(filepath: string): Promise<boolean> {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Backup file does not exist: ${filepath}`);
  }

  const stats = fs.statSync(filepath);
  if (stats.size === 0) {
    throw new Error("Backup file is zero bytes");
  }

  if (filepath.endsWith(".sql")) {
    const content = fs.readFileSync(filepath, "utf8");
    const hasTables = content.includes("CREATE TABLE") || content.includes("COPY ");
    if (!hasTables) {
      throw new Error("Backup SQL does not contain CREATE TABLE or COPY directives");
    }
    return true;
  } else if (filepath.endsWith(".sqlite")) {
    // Basic SQLite header check
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filepath, "r");
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    const header = buffer.toString("utf8", 0, 15);
    if (!header.startsWith("SQLite format 3")) {
      throw new Error("Invalid SQLite file header");
    }
    return true;
  }

  throw new Error("Unknown backup file format");
}

export async function restoreBackup(filepath: string, targetDbName?: string): Promise<void> {
  await verifyBackup(filepath);

  const app = await createCliApplication({
    skipSecurity: true,
    skipComposition: true,
  });

  const { config } = app;

  if (filepath.endsWith(".sql")) {
    const connStr = config.connectionString;
    const dbName = targetDbName || (connStr ? connStr.split("/").pop()?.split("?")[0] : "mosaix");

    try {
      execFileSync("psql", ["--version"], { stdio: "ignore" });
      execFileSync("psql", ["-d", connStr || dbName, "-f", filepath], {
        stdio: "pipe",
        timeout: 120_000,
      });
    } catch {
      // Fallback to Docker
      const containerName = process.env.MOSAIX_DB_CONTAINER || "mosaix-db-1";
      const sqlContent = fs.readFileSync(filepath, "utf8");
      execFileSync("docker", ["exec", "-i", containerName, "psql", "-U", "mosaix", "-d", dbName], {
        input: sqlContent,
        timeout: 120_000,
      });
    }
  } else if (filepath.endsWith(".sqlite")) {
    const dbPath = path.resolve(process.cwd(), config.database || "data/mosaix.sqlite");
    fs.copyFileSync(filepath, dbPath);
  } else {
    throw new Error("Unsupported backup format for restore");
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("db-backup.ts")) {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    console.log("Available backups in .mosaix/backups/:\n");
    const files = listBackups();
    if (files.length === 0) {
      console.log("  (no backups found)");
    } else {
      files.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(0);
  }

  const restoreIdx = args.indexOf("--restore");
  if (restoreIdx >= 0) {
    const file = args[restoreIdx + 1];
    if (!file) {
      console.error("Error: --restore requires a backup file path");
      process.exit(1);
    }
    const targetIdx = args.indexOf("--target");
    const targetDb = targetIdx >= 0 ? args[targetIdx + 1] : undefined;

    console.log(`Restoring backup ${file}...`);
    restoreBackup(file, targetDb)
      .then(() => {
        console.log("✓ Backup restored successfully!");
        process.exit(0);
      })
      .catch((err) => {
        console.error("✖ Restore failed:", err.message);
        process.exit(1);
      });
  } else {
    console.log("Creating database backup...");
    createBackup()
      .then((res) => {
        console.log(`✓ Backup created successfully!`);
        console.log(`  File: ${res.filepath}`);
        console.log(`  Driver: ${res.driver}`);
        console.log(`  Size: ${(res.sizeBytes / 1024).toFixed(1)} KB`);
        process.exit(0);
      })
      .catch((err) => {
        console.error("✖ Backup failed:", err.message);
        process.exit(1);
      });
  }
}
