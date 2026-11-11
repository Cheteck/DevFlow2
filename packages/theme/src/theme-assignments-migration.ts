/**
 * @mosaix/theme — Theme assignments migration
 */
import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const THEME_ASSIGNMENTS_MIGRATION_ID =
  "core.theme.v1.001_create_theme_assignments";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "558d35cdb206a8ed096dc9a678ad24b6f06687b8788d0f85c8050aeb29085d8d";
/* checksum:end */

export class ThemeAssignmentsMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "core.theme";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: THEME_ASSIGNMENTS_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        up: (context: MigrationContext) => {
          context.schema.createTable("theme_assignments", (table) => {
            table.string("target_type");
            table.string("target_id");
            table.string("theme_id");
            table.string("mode").default("system");
            table.string("version").nullable();
            table.string("source").default("platform");
            table.timestamp("updated_at");
            table.string("updated_by").nullable();
            table.index("idx_theme_assignments_target", [
              "target_type",
              "target_id",
            ]);
            table.index("idx_theme_assignments_theme", ["theme_id"]);
          });
          context.schema.createIndex(
            "theme_assignments",
            "uniq_theme_assignments_target",
            ["target_type", "target_id"],
            { unique: true },
          );
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("theme_assignments");
        },
        resources: ["table:theme_assignments"],
      },
    ];
  }
}
