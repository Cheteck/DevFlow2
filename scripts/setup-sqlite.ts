/**
 * @scripts/setup-sqlite — Database setup (Laravel `migrate --seed`).
 *
 * Resolves the driver from `.env` (`DB_CONNECTION` / `DB_*` / `DATABASE_URL`,
 * default `sqlite:data/mosaix.sqlite`), awaits the connect hook, applies
 * pending migrations through the engine, runs the baseline seeders, then
 * reports table counts. The only sanctioned writer of schema + demo data.
 */
import { loadEnvFile, validateEnv } from "@mosaix/core";
import { databaseReady } from "../src/shell/database-bootstrap.js";
import { runShellMigrations } from "../src/shell/migrations.js";
import { runDatabaseSeeds } from "../src/shell/seeders/database-seeder.js";

async function main() {
  loadEnvFile();
  validateEnv(process.env as Record<string, string | undefined>);

  console.log("==================================================");
  console.log("   MosaiX Platform — Initialisation base de données");
  console.log("==================================================");

  const { dbAdapter, config } = await databaseReady();
  const where =
    config.connection === "sqlite"
      ? `sqlite:${config.database}`
      : `pgsql:${config.connectionString}`;
  console.log(`✓ Pilote résolu depuis .env [${where}] (WAL, foreign keys, busy timeout)`);

  const migrated = await runShellMigrations(dbAdapter);
  console.log(
    migrated.applied.length > 0
      ? `✓ Migrations appliquées (${migrated.applied.length}) : ${migrated.applied.join(", ")}`
      : "✓ Migrations à jour (rien à appliquer)",
  );

  const seeded = await runDatabaseSeeds(dbAdapter);
  console.log(
    seeded.length > 0
      ? `✓ Seeds insérés : ${seeded.join(", ")}`
      : "✓ Seeds à jour (tables non vides, rien à insérer)",
  );

  // Verify tables
  const tables =
    dbAdapter.capabilities.dialect === "postgres"
      ? await dbAdapter.query<{ name: string }>(
          `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename ASC`,
        )
      : await dbAdapter.query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC`,
        );

  console.log(`✓ Tables vérifiées (${tables.length} tables opérationnelles) :`);
  tables.forEach((t) => console.log(`   - ${t.name}`));

  // Check counts
  const feedCount = await dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM shell_feed`);
  const prodCount = await dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM commerce_products`);
  const portCount = await dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM portfolio_items`);
  const spaceCount = await dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM spaces`);

  console.log("\n✓ Enregistrements opérationnels :");
  console.log(`   - Publications Sociales : ${feedCount[0]?.count || 0}`);
  console.log(`   - Produits Boutique     : ${prodCount[0]?.count || 0}`);
  console.log(`   - Créations Portfolio   : ${portCount[0]?.count || 0}`);
  console.log(`   - Espaces de Travail    : ${spaceCount[0]?.count || 0}`);

  console.log("\n🎉 Base de données prête et opérationnelle !");
}

main().catch((err) => {
  console.error("Erreur lors de l'initialisation :", err);
  process.exit(1);
});
