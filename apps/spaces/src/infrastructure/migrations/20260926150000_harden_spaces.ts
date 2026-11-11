import {
  equals,
  func,
  isNotNull,
  isNull,
  value,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "7ac9a20b36781255c4269dfdab255327132c061343c192d8f8da3f6c41bc87fa";
/* checksum:end */

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
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

export const migration: Migration = {
  id: "spaces.membership.v1.003_harden_rbac",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["203ac7c5dfa7611c"],
  resources: [
    // v1.003_harden_spaces AJOUTE des contraintes/index a des tables existantes
    // (roles, permission_overrides, spaces, acting_as_audit_events,
    // role_audit_events, space_members).
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:spaces.roles",
    "table:spaces.permission_overrides",
    "table:spaces.spaces",
    "table:spaces.acting_as_audit_events",
    "table:spaces.role_audit_events",
    "table:spaces.space_members",
  ],
  up: (context: MigrationContext) => {
    context.schema.addConstraint(
      { schema: "spaces", name: "roles" },
      "roles_scope_check",
      'CHECK (("scopeType" = \'GLOBAL\' AND "scopeId" IS NULL) OR ("scopeType" = \'SPACE\' AND "scopeId" IS NOT NULL))',
    );
    context.schema.addConstraint(
      { schema: "spaces", name: "roles" },
      "fk_roles_inheritsFrom",
      'FOREIGN KEY ("inheritsFrom") REFERENCES "spaces"."roles" ("id")',
    );
    context.schema.createIndex(
      { schema: "spaces", name: "roles" },
      "uniq_roles_key_global",
      [{ name: "key" }],
      {
        unique: true,
        ifNotExists: true,
        where: [equals("scopeType", value("GLOBAL"))],
      },
    );
    context.schema.createIndex(
      { schema: "spaces", name: "roles" },
      "uniq_roles_key_scope",
      [{ name: "key" }, { name: "scopeId" }],
      {
        unique: true,
        ifNotExists: true,
        where: [equals("scopeType", value("SPACE"))],
      },
    );
    context.schema.dropConstraint(
      { schema: "spaces", name: "permission_overrides" },
      "uniq_permission_overrides",
    );
    context.schema.dropIndex("uniq_permission_overrides", "spaces");
    context.schema.createIndex(
      { schema: "spaces", name: "permission_overrides" },
      "permission_overrides_global_unique",
      [{ name: "userId" }, { name: "permissionKey" }],
      { unique: true, ifNotExists: true, where: [isNull("spaceId")] },
    );
    context.schema.createIndex(
      { schema: "spaces", name: "permission_overrides" },
      "permission_overrides_space_unique",
      [{ name: "userId" }, { name: "spaceId" }, { name: "permissionKey" }],
      { unique: true, ifNotExists: true, where: [isNotNull("spaceId")] },
    );
    context.schema.addConstraint(
      { schema: "spaces", name: "spaces" },
      "spaces_followers_check",
      'CHECK ("followersCount" >= 0)',
    );
    context.schema.createFunction(
      "prevent_audit_mutation",
      " BEGIN RAISE EXCEPTION 'Audit table % is append-only', TG_TABLE_NAME; RETURN NULL; END; ",
      {
        schema: "spaces",
        returns: "TRIGGER",
        language: "plpgsql",
        replace: true,
      },
    );
    context.schema.dropTrigger(
      "trg_acting_audit_immutable",
      "acting_as_audit_events",
      { schema: "spaces" },
    );
    context.schema.createTrigger(
      "trg_acting_audit_immutable",
      "acting_as_audit_events",
      ["update", "delete"],
      "before",
      "prevent_audit_mutation",
      { schema: "spaces", functionSchema: "spaces" },
    );
    context.schema.dropTrigger(
      "trg_role_audit_immutable",
      "role_audit_events",
      { schema: "spaces" },
    );
    context.schema.createTrigger(
      "trg_role_audit_immutable",
      "role_audit_events",
      ["update", "delete"],
      "before",
      "prevent_audit_mutation",
      { schema: "spaces", functionSchema: "spaces" },
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "spaces" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "spaces" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "roles" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "roles" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "space_members" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "space_members" },
      "updatedAt",
      func("now"),
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "space_members" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "space_members" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "roles" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "roles" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "spaces" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "spaces", name: "spaces" },
      "createdAt",
    );
    context.schema.dropTrigger(
      "trg_role_audit_immutable",
      "role_audit_events",
      { schema: "spaces" },
    );
    context.schema.dropTrigger(
      "trg_acting_audit_immutable",
      "acting_as_audit_events",
      { schema: "spaces" },
    );
    context.schema.dropFunction("prevent_audit_mutation", { schema: "spaces" });
    context.schema.dropConstraint(
      { schema: "spaces", name: "spaces" },
      "spaces_followers_check",
    );
    context.schema.dropIndex("permission_overrides_space_unique", "spaces");
    context.schema.dropIndex("permission_overrides_global_unique", "spaces");
    context.schema.createIndex(
      { schema: "spaces", name: "permission_overrides" },
      "uniq_permission_overrides",
      [{ name: "userId" }, { name: "spaceId" }, { name: "permissionKey" }],
      { unique: true, ifNotExists: true },
    );
    context.schema.dropIndex("uniq_roles_key_scope", "spaces");
    context.schema.dropIndex("uniq_roles_key_global", "spaces");
    context.schema.dropConstraint(
      { schema: "spaces", name: "roles" },
      "fk_roles_inheritsFrom",
    );
    context.schema.dropConstraint(
      { schema: "spaces", name: "roles" },
      "roles_scope_check",
    );
  },
};
