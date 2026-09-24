import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// 1. Spaces Table
builder.createTable("spaces_spaces", (table) => {
  table.string("id").primary();
  table.string("name");
  table.string("slug");
  table.string("category").nullable();
  table.string("template").nullable();
  table.string("ownerId");
  table.string("tenantId").nullable();
  table.integer("followersCount").default(0);
  table.string("customDomain").nullable();
  table.json("enabledCapabilities").nullable();
  table.json("publicNavigation").nullable();
  table.json("team").nullable();
  table.json("data");
  table.timestamp("createdAt");
  table.timestamp("updatedAt").nullable();
  table.unique("uniq_spaces_slug", ["slug"]);
  table.index("idx_spaces_owner", ["ownerId"]);
  table.index("idx_spaces_tenant", ["tenantId"]);
  table.index("idx_spaces_domain", ["customDomain"]);
});

// 2. Permissions Table
builder.createTable("permissions", (table) => {
  table.string("key").primary();
  table.string("description");
  table.string("scope");
  table.json("assignableBy").nullable();
  table.json("metadata").nullable();
});

// 3. Roles Table
builder.createTable("roles", (table) => {
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
builder.createTable("role_permissions", (table) => {
  table.string("roleId");
  table.string("permissionKey");
  table.enum("effect", ["ALLOW", "DENY"]).default("ALLOW");
  table.foreignKey("roleId", "roles", "id");
  table.foreignKey("permissionKey", "permissions", "key");
  table.unique("uniq_role_permissions", ["roleId", "permissionKey"]);
});

// 5. Global User Roles
builder.createTable("global_user_roles", (table) => {
  table.string("userId");
  table.string("roleId");
  table.string("grantedBy").nullable();
  table.timestamp("grantedAt");
  table.timestamp("expiresAt").nullable();
  table.foreignKey("roleId", "roles", "id");
  table.unique("uniq_global_user_roles", ["userId", "roleId"]);
});

// 6. Space Members
builder.createTable("space_members", (table) => {
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
builder.createTable("permission_overrides", (table) => {
  table.string("userId");
  table.string("spaceId").nullable();
  table.string("permissionKey");
  table.enum("effect", ["ALLOW", "DENY"]);
  table.timestamp("expiresAt").nullable();
  table.string("grantedBy").nullable();
  table.foreignKey("permissionKey", "permissions", "key");
  table.unique("uniq_permission_overrides", ["userId", "spaceId", "permissionKey"]);
});

// 8. Acting-As Audit Events
builder.createTable("acting_as_audit_events", (table) => {
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
builder.createTable("role_audit_events", (table) => {
  table.string("id").primary();
  table.string("actorUserId");
  table.string("targetRoleId").nullable();
  table.string("action");
  table.json("metadata").nullable();
  table.timestamp("createdAt");
  table.index("idx_role_audit_actor", ["actorUserId"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162100_create_spaces_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
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
  ]
};
