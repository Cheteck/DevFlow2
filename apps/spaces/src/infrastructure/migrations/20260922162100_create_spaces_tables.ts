import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "97df584a159425cbe5deb0f221f05ee5ae518c238c6b20fadcd2b96e60b27852";
/* checksum:end */

/**
 * spaces.membership.v1.001_create_spaces_tables
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
  id: "spaces.membership.v1.001_create_spaces_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["8b3a5200a4001b4a"],
  up: (context: MigrationContext) => {
    // 1. Spaces Table
    context.schema.createTable("spaces_spaces", (table) => {
      table.string("id").primary();
      table.string("name");
      table.string("slug");
      table.string("category").nullable();
      table.string("template").nullable();
      table.string("ownerId");
      table.string("tenantId").nullable();
      table.integer("followersCount").default(0);
      table.string("customDomain").nullable();
      table.string("subscriptionPlan").nullable();
      table.json("enabledCapabilities").nullable();
      table.json("publicNavigation").nullable();
      table.json("team").nullable();
      table.json("data");
      table.timestamp("createdAt");
      table.timestamp("updatedAt").nullable();
      table.unique("uniq_spaces_slug", ["slug"]);
      table.unique("uniq_spaces_custom_domain", ["customDomain"]);
      table.index("idx_spaces_owner", ["ownerId"]);
      table.index("idx_spaces_tenant", ["tenantId"]);
    });

    // 2. Permissions Table
    context.schema.createTable("permissions", (table) => {
      table.string("key").primary();
      table.string("description");
      table.string("scope");
      table.json("assignableBy").nullable();
      table.json("metadata").nullable();
    });

    // 3. Roles Table
    context.schema.createTable("roles", (table) => {
      table.string("id").primary();
      table.string("key");
      table.string("name");
      table.enum("scopeType", ["GLOBAL", "SPACE"]);
      table.string("scopeId").nullable();
      table.integer("rank").default(10);
      table.boolean("isSystem").default(false);
      table.string("inheritsFrom").nullable();
      table.string("createdBy").nullable();
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.index("idx_roles_scope", ["scopeType", "scopeId"]);
    });

    // 4. Role Permissions
    context.schema.createTable("role_permissions", (table) => {
      table.string("roleId");
      table.string("permissionKey");
      table.enum("effect", ["ALLOW", "DENY"]).default("ALLOW");
      table.foreignKey("roleId", "roles", "id");
      table.foreignKey("permissionKey", "permissions", "key");
      table.unique("uniq_role_permissions", ["roleId", "permissionKey"]);
    });

    // 5. Global User Roles
    context.schema.createTable("global_user_roles", (table) => {
      table.string("userId");
      table.string("roleId");
      table.string("grantedBy").nullable();
      table.timestamp("grantedAt");
      table.timestamp("expiresAt").nullable();
      table.foreignKey("roleId", "roles", "id");
      table.unique("uniq_global_user_roles", ["userId", "roleId"]);
    });

    // 6. Space Members
    context.schema.createTable("space_members", (table) => {
      table.string("spaceId");
      table.string("userId");
      table.string("roleId");
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.foreignKey("spaceId", "spaces_spaces", "id");
      table.foreignKey("roleId", "roles", "id");
      table.unique("uniq_space_members", ["spaceId", "userId"]);
      table.index("idx_space_members_user", ["userId"]);
    });

    // 7. Permission Overrides
    context.schema.createTable("permission_overrides", (table) => {
      table.string("userId");
      table.string("spaceId").nullable();
      table.string("permissionKey");
      table.enum("effect", ["ALLOW", "DENY"]);
      table.timestamp("expiresAt").nullable();
      table.string("grantedBy").nullable();
      table.foreignKey("permissionKey", "permissions", "key");
      table.unique("uniq_permission_overrides", [
        "userId",
        "spaceId",
        "permissionKey",
      ]);
    });

    // 8. Acting-As Audit Events
    context.schema.createTable("acting_as_audit_events", (table) => {
      table.string("id").primary();
      table.string("actorUserId");
      table.string("targetUserId");
      table.string("spaceId").nullable();
      table.string("action");
      table.json("metadata").nullable();
      table.json("permissionsUsed").nullable();
      table.string("ip").nullable();
      table.timestamp("createdAt");
      table.index("idx_acting_as_actor", ["actorUserId"]);
      table.index("idx_acting_as_target", ["targetUserId"]);
    });

    // 9. Role Audit Events
    context.schema.createTable("role_audit_events", (table) => {
      table.string("id").primary();
      table.string("actorUserId");
      table.string("targetRoleId").nullable();
      table.string("action");
      table.json("metadata").nullable();
      table.timestamp("createdAt");
      table.index("idx_role_audit_actor", ["actorUserId"]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("role_audit_events");
    context.schema.dropTable("acting_as_audit_events");
    context.schema.dropTable("permission_overrides");
    context.schema.dropTable("space_members");
    context.schema.dropTable("global_user_roles");
    context.schema.dropTable("role_permissions");
    context.schema.dropTable("roles");
    context.schema.dropTable("permissions");
    context.schema.dropTable("spaces_spaces");
  },
  resources: [
    "table:spaces_spaces",
    "table:permissions",
    "table:roles",
    "table:role_permissions",
    "table:global_user_roles",
    "table:space_members",
    "table:permission_overrides",
    "table:acting_as_audit_events",
    "table:role_audit_events",
  ],
};
