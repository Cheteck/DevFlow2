/**
 * @apps/citadelle — Patch orphelin NON APPLIQUÉ (évalué, vague citadelle).
 *
 * Cibles : `citadelle_identities` (last_login_at, mfa_enabled) et
 * `citadelle_sessions` (ip_address, user_agent) — tables réservées du
 * provider citadelle, PAS des tables shell-owned : aucun conflit
 * d'ownership avec `shell.core.v1.001`.
 *
 * NON-APPLICATION maintenue pour deux raisons :
 * 1. Phase-0 (`src/shell/bac-migrations.ts`, exclu délibéré) n'enregistre
 *    qu'1 migration/wave avec garde de longueur ; enregistrer ce patch via le
 *    provider donnerait 2 migrations et casserait `migrate:status` sans
 *    pouvoir toucher `src/shell/*` (interdit pour cette vague).
 * 2. Contenu = MFA persisté (`mfa_enabled`) : hors périmètre, backlog vague
 *    citadelle (avec `social_accounts`, wizard persistant, `citadelle_users`
 *    / `audit_logs` promis par la doc).
 */
import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// Renforcement sécurité Citadelle
builder.addColumn("citadelle_identities", "last_login_at", "timestamp", (col) => col.nullable());
builder.addColumn("citadelle_identities", "mfa_enabled", "boolean", (col) => col.default(false));
builder.addColumn("citadelle_sessions", "ip_address", "string", (col) => col.nullable());
builder.addColumn("citadelle_sessions", "user_agent", "string", (col) => col.nullable());

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161500_harden_citadelle_security",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:citadelle_identities", "table:citadelle_sessions"],
};
