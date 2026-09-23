/**
 * @mosaix/migrations — DependencyResolver (Phase 6 DAG & Global Ordonnancement R10)
 *
 * Tri topologique déterministe des migrations :
 *  - les dépendances (`Migration.dependencies`, ids exacts) sont ordonnées avant
 *    leurs dépendants (DFS, détection de cycle) ;
 *  - à dépendances égales, les migrations `framework.*` passent avant les
 *    migrations applicatives (R10), puis `compareMigrationIds` (R6) ;
 *  - les dépendances absentes de l'entrée sont ignorées (tolérant : le Planner
 *    reste l'autorité sur la cohérence store/registry, R5).
 */

import { compareMigrationIds } from "./migration";
import type { Migration } from "./migration";

function isFramework(id: string): boolean {
  return id === "framework" || id.startsWith("framework.");
}

export class DependencyResolver {
  static resolve(migrations: readonly Migration[]): Migration[] {
    const byId = new Map(migrations.map((m) => [m.id, m]));
    // Ordre stable d'entrée : framework d'abord, puis R6.
    const entryOrder = [...migrations].sort((a, b) => {
      const fa = isFramework(a.id) ? 0 : 1;
      const fb = isFramework(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return compareMigrationIds(a.id, b.id);
    });

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: Migration[] = [];

    const visit = (migration: Migration): void => {
      if (visited.has(migration.id)) return;
      if (visiting.has(migration.id)) {
        throw new Error(`Circular dependency detected involving migration: ${migration.id}`);
      }
      visiting.add(migration.id);
      for (const depId of migration.dependencies ?? []) {
        const dep = byId.get(depId);
        if (dep !== undefined) visit(dep);
      }
      visiting.delete(migration.id);
      visited.add(migration.id);
      sorted.push(migration);
    };

    for (const migration of entryOrder) {
      visit(migration);
    }
    return sorted;
  }
}
