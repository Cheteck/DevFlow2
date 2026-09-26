import { SQLiteDatabaseAdapter } from "../packages/adapters/database-sqlite/src/index.js";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

async function initAdmin() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "mosaix.sqlite");
  const dbAdapter = new SQLiteDatabaseAdapter(dbPath);

  // Schema is migration-owned (shell.core.v1.001 + `pnpm db:setup` runs
  // before this script in the install flow). No DDL here — fail fast if
  // the migrated schema is absent so drift surfaces instead of forking.
  const tables = await dbAdapter.query<{ name: string }>(
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
  
  const existing = await dbAdapter.query<{ id: string }>(
    `SELECT id FROM identities WHERE email = ?`,
    [adminEmail]
  );

  if (existing.length > 0) {
    console.log(`[security] Admin account '${adminEmail}' already exists. Skipping.`);
    return;
  }

  await dbAdapter.execute(`
    INSERT INTO identities (id, email, password_hash, roles, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [crypto.randomUUID(), adminEmail, passwordHash, JSON.stringify(["admin"]), new Date().toISOString()]);
  
  console.log(`[security] Admin account initialized for '${adminEmail}' with salted scrypt key.`);
  if (!explicitPassword) {
    console.log(`[security] Generated Admin Password: ${adminPassword} (set ADMIN_PASSWORD env in prod)`);
  }
}

initAdmin().catch(console.error);
