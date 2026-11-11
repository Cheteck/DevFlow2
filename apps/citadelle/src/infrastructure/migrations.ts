/**
 * @apps/citadelle — Postgres migration manifest (Phase-0 BAC wiring).
 *
 * OWNERSHIP RÉSOLUE : le shell possède les tables d'authentification core
 * (`identities`, `credentials`, `sessions`, `tokens`, `external_identities`
 * non préfixées, créées par `shell.core.v1.003_minimal_core_tables`).
 *
 * Ce provider NE CRÉE PLUS les tables `citadelle_*` préfixées :
 * - Elles étaient inutilisées (runtime = tables shell via adapters partagés)
 * - Doublon résolu : tables shell = source de vérité unique
 * - Transfert d'ownership `citadelle_*` → shell effectué
 *
 * Ce provider expose une migration no-op (garde de longueur Phase-0 :
 * `CanonicalIdProvider` attend exactement 1 migration). La vraie vague
 * citadelle (DB-BAC-OWNERSHIP) pourra plus tard ajouter des tables
 * spécifiques citadelle (`social_accounts`, `registration_drafts`, etc.)
 * via une migration `citadelle.auth.v1.002_...`.
 */
import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";
import { migration as mfaSecretsMigration } from "./migrations/20261108130000_create_mfa_secrets.js";

export const CITADELLE_MIGRATION_ID =
  "citadelle.auth.v1.001_create_auth_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "e6248723a96eb3e8a572c2a21e14a11da545abfdbc7a3c8a26843bba74da6e2f";
/* checksum:end */

export class CitadellePostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "citadelle";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: CITADELLE_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["f27844be7badbd53"],
        up: (context: MigrationContext) => {
          // No-op : tables d'auth core possédées par le shell (identities, credentials,
          // sessions, tokens, external_identities). Cette migration existe uniquement
          // pour satisfaire le garde de longueur Phase-0 (1 migration attendue).
          context.schema.createTable("__citadelle_noop", (table) => {
            table.string("placeholder").primary().default("migrated");
          });
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("__citadelle_noop");
        },
        resources: ["table:__citadelle_noop"],
      },
      mfaSecretsMigration,
    ];
  }
}
