import * as crypto from "node:crypto";
import { loadEnvFile } from "@mosaix/core";
import { closeDatabase, databaseReady } from "../src/shell/database-bootstrap.js";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

async function initAdmin() {
  loadEnvFile();

  try {
  const { dbAdapter, config } = await databaseReady();
  const driver = config.connection === "pgsql" ? "PostgreSQL" : "SQLite";
  console.log(`[database] Using driver: ${driver}`);

  // Schema is migration-owned (shell.core.v1.001 + `pnpm db:setup` runs
  // before this script in the install flow). No DDL here — fail fast if
  // the migrated schema is absent so drift surfaces instead of forking.
  const tables =
    config.connection === "pgsql"
      ? await dbAdapter.query<{ name: string }>(
          `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename = 'identities'`,
        )
      : await dbAdapter.query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'identities'`,
        );
  if (tables.length === 0) {
    throw new Error(
      "[security] Table 'identities' missing — run 'pnpm db:setup' (migrations) before creating the admin.",
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@mosaix.local";
  const explicitPassword = process.env.ADMIN_PASSWORD;
  const adminPassword = explicitPassword || crypto.randomBytes(12).toString("base64url");
  const passwordHash = hashPassword(adminPassword);
  
  const existing =
    config.connection === "pgsql"
      ? await dbAdapter.query<{ id: string }>(
          `SELECT id FROM identities WHERE email = $1`,
          [adminEmail],
        )
      : await dbAdapter.query<{ id: string }>(
          `SELECT id FROM identities WHERE email = ?`,
          [adminEmail],
        );

  if (existing.length > 0) {
    console.log(`[security] Admin account '${adminEmail}' already exists. Skipping.`);
    return;
  }

  if (config.connection === "pgsql") {
    await dbAdapter.execute(
      `INSERT INTO identities (id, email, password_hash, roles, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), adminEmail, passwordHash, JSON.stringify(["admin"]), new Date().toISOString()],
    );
  } else {
    await dbAdapter.execute(
      `INSERT INTO identities (id, email, password_hash, roles, created_at) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), adminEmail, passwordHash, JSON.stringify(["admin"]), new Date().toISOString()],
    );
  }
  
  console.log(`[security] Admin account initialized for '${adminEmail}' with salted scrypt key.`);
  if (!explicitPassword) {
    console.log(`[security] Generated Admin Password: ${adminPassword} (set ADMIN_PASSWORD env in prod)`);
  }
  } finally {
    // Release the pool (PostgreSQL sockets keep the event loop alive).
    await closeDatabase();
  }
}

initAdmin().catch(console.error);
