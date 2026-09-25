/**
 * @scripts/setup-sqlite — Interactive SQLite Schema Setup & Seed Verification
 */

import { initDatabase } from "../src/shell/database-bootstrap.js";

async function main() {
  console.log("==================================================");
  console.log("   MosaiX Platform — Initialisation SQLite");
  console.log("==================================================");

  const bootstrap = initDatabase();
  console.log("✓ Initialisation du pilote SQLite (WAL mode, foreign keys, concurrent timeouts)");

  // Verify tables
  const tables = await bootstrap.dbAdapter.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC`
  );

  console.log(`✓ Tables vérifiées (${tables.length} tables opérationnelles) :`);
  tables.forEach(t => console.log(`   - ${t.name}`));

  // Check counts
  const feedCount = await bootstrap.dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM shell_feed`);
  const prodCount = await bootstrap.dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM commerce_products`);
  const portCount = await bootstrap.dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM portfolio_items`);
  const spaceCount = await bootstrap.dbAdapter.query<{ count: number }>(`SELECT COUNT(*) as count FROM spaces`);

  console.log("\n✓ Enregistrements opérationnels :");
  console.log(`   - Publications Sociales : ${feedCount[0]?.count || 0}`);
  console.log(`   - Produits Boutique     : ${prodCount[0]?.count || 0}`);
  console.log(`   - Créations Portfolio   : ${portCount[0]?.count || 0}`);
  console.log(`   - Espaces de Travail    : ${spaceCount[0]?.count || 0}`);

  console.log("\n🎉 Base de données SQLite prête et opérationnelle !");
}

main().catch(err => {
  console.error("Erreur lors de l'initialisation de SQLite :", err);
  process.exit(1);
});
