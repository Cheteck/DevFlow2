/**
 * @apps/citadelle — Postgres migration provider (Phase-0 BAC wiring).
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
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class CitadellePostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "citadelle";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    // No-op : tables d'auth core possédées par le shell (identities, credentials,
    // sessions, tokens, external_identities). Cette migration existe uniquement
    // pour satisfaire le garde de longueur Phase-0 (1 migration attendue).
    builder.createTable("__citadelle_noop", (table) => {
      table.string("placeholder").primary().default("migrated");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "__citadelle_noop" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    return [
      {
        id: "citadelle.auth.v1.001_create_auth_tables",
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: ["table:__citadelle_noop"],
      },
    ];
  }
}