import type { Migration, MigrationProvider } from "@mosaix/migrations";
import { migration as createSocialTables } from "./migrations/20260926093000_create_social_tables.js";
import { migration as moveToSolaraSchema } from "./migrations/20260926094000_move_to_solara_schema.js";
import { migration as hardenSolara } from "./migrations/20260926130000_harden_solara.js";

/**
 * Solara migration manifest (ADR-0006 R1).
 *
 * The engine never scans the filesystem: the migrations of the BAC are
 * declared here, in an explicit manifest, each one carrying its canonical
 * identity (`owner.module.version.sequence_name`), its resources and its
 * TypeScript native body.
 *
 * - `solara.social.v1.001_create_social_tables` — creates the social tables.
 * - `solara.social.v1.002_move_to_schema` — moves them to the `solara` schema.
 * - `solara.social.v1.003_harden_social` — hardens their integrity.
 */
export class SolaraPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solara";
  }

  migrations(): readonly Migration[] {
    return [createSocialTables, moveToSolaraSchema, hardenSolara];
  }
}
