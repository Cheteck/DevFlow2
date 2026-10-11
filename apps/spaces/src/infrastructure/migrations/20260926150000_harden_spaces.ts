import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * spaces.membership.v1.003 — harden RBAC integrity (critique schéma).
 *
 * Verified against the live DB before writing: PKs exist on all tables with
 * an id, creation order is correct, FKs present — the syntax/order claims do
 * NOT apply to our compiled migrations. This migration adds what is REALLY
 * missing, on the `spaces.*` names (v1.002):
 *
 * - roles: scope coherence (GLOBAL → scopeId NULL, SPACE → NOT NULL);
 *   self-FK on inheritsFrom; key uniqueness per scope (global key alone,
 *   key+scopeId for SPACE — NULLs are distinct in classic UNIQUEs).
 * - permission_overrides: the classic UNIQUE(userId,spaceId,permissionKey)
 *   is NULL-blind — replace with two partial uniques (global scope and
 *   space scope). NOTE: v1.001 created it as a standalone UNIQUE INDEX
 *   (verified live), so drop it as an INDEX (both forms attempted).
 * - spaces: followersCount fenced >= 0.
 * - audit tables (acting_as_audit_events, role_audit_events): append-only
 *   triggers — verified zero writers doing UPDATE/DELETE in code; audit
 *   rows must never be mutated or removed by application roles.
 * - DEFAULT now() on createdAt/updatedAt where present.
 *
 * Deliberately NOT changed (documented in docs/bacs/05-spaces.md):
 * slug stays globally unique (platform-wide URLs); customDomain stays
 * unique (multi-NULL allowed by Postgres, which is the desired behavior);
 * rank semantics (higher = more privilege) documented, not enforced;
 * inheritance cycles need a recursive trigger (deferred, documented);
 * owner auto-membership has no code path (documented open rule);
 * evaluation precedence (explicit DENY wins, unknown denied) lives in the
 * authorization layer, not in DDL — enforced when the RBAC tables get
 * writers (currently only spaces_spaces is managed).
 *
 * Postgres-only.
 */

const upStatements: string[] = [
  // 1. Roles: scope coherence + self-referenced inheritance.
  `ALTER TABLE "spaces"."roles" ADD CONSTRAINT "roles_scope_check" CHECK (("scopeType" = 'GLOBAL' AND "scopeId" IS NULL) OR ("scopeType" = 'SPACE' AND "scopeId" IS NOT NULL));`,
  `ALTER TABLE "spaces"."roles" ADD CONSTRAINT "fk_roles_inheritsFrom" FOREIGN KEY ("inheritsFrom") REFERENCES "spaces"."roles" ("id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_roles_key_global" ON "spaces"."roles" ("key") WHERE "scopeType" = 'GLOBAL';`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_roles_key_scope" ON "spaces"."roles" ("key", "scopeId") WHERE "scopeType" = 'SPACE';`,

  // 2. Overrides: NULL-aware uniqueness per scope.
  `ALTER TABLE "spaces"."permission_overrides" DROP CONSTRAINT IF EXISTS "uniq_permission_overrides";`,
  `DROP INDEX IF EXISTS "spaces"."uniq_permission_overrides";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "permission_overrides_global_unique" ON "spaces"."permission_overrides" ("userId", "permissionKey") WHERE "spaceId" IS NULL;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "permission_overrides_space_unique" ON "spaces"."permission_overrides" ("userId", "spaceId", "permissionKey") WHERE "spaceId" IS NOT NULL;`,

  // 3. Spaces: non-negative audience counter.
  `ALTER TABLE "spaces"."spaces" ADD CONSTRAINT "spaces_followers_check" CHECK ("followersCount" >= 0);`,

  // 4. Audit tables: append-only (no UPDATE/DELETE from application roles).
  `CREATE OR REPLACE FUNCTION "spaces"."prevent_audit_mutation"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Audit table % is append-only', TG_TABLE_NAME; RETURN NULL; END; $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS "trg_acting_audit_immutable" ON "spaces"."acting_as_audit_events";`,
  `CREATE TRIGGER "trg_acting_audit_immutable" BEFORE UPDATE OR DELETE ON "spaces"."acting_as_audit_events" FOR EACH ROW EXECUTE FUNCTION "spaces"."prevent_audit_mutation"();`,
  `DROP TRIGGER IF EXISTS "trg_role_audit_immutable" ON "spaces"."role_audit_events";`,
  `CREATE TRIGGER "trg_role_audit_immutable" BEFORE UPDATE OR DELETE ON "spaces"."role_audit_events" FOR EACH ROW EXECUTE FUNCTION "spaces"."prevent_audit_mutation"();`,

  // 5. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "spaces"."spaces" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "spaces"."spaces" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "spaces"."roles" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "spaces"."roles" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "spaces"."space_members" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "spaces"."space_members" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
];

const downStatements: string[] = [
  `ALTER TABLE "spaces"."space_members" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "spaces"."space_members" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "spaces"."roles" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "spaces"."roles" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "spaces"."spaces" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "spaces"."spaces" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `DROP TRIGGER IF EXISTS "trg_role_audit_immutable" ON "spaces"."role_audit_events";`,
  `DROP TRIGGER IF EXISTS "trg_acting_audit_immutable" ON "spaces"."acting_as_audit_events";`,
  `DROP FUNCTION IF EXISTS "spaces"."prevent_audit_mutation"();`,
  `ALTER TABLE "spaces"."spaces" DROP CONSTRAINT IF EXISTS "spaces_followers_check";`,
  `DROP INDEX IF EXISTS "spaces"."permission_overrides_space_unique";`,
  `DROP INDEX IF EXISTS "spaces"."permission_overrides_global_unique";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_permission_overrides" ON "spaces"."permission_overrides" ("userId", "spaceId", "permissionKey");`,
  `DROP INDEX IF EXISTS "spaces"."uniq_roles_key_scope";`,
  `DROP INDEX IF EXISTS "spaces"."uniq_roles_key_global";`,
  `ALTER TABLE "spaces"."roles" DROP CONSTRAINT IF EXISTS "fk_roles_inheritsFrom";`,
  `ALTER TABLE "spaces"."roles" DROP CONSTRAINT IF EXISTS "roles_scope_check";`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926150000_harden_spaces",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:spaces.roles",
    "table:spaces.permission_overrides",
    "table:spaces.spaces",
    "table:spaces.acting_as_audit_events",
    "table:spaces.role_audit_events",
    "table:spaces.space_members",
  ],
};
