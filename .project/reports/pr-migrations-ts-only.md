## Objective

Le moteur de migrations `@mosaix/migrations` n'accepte **plus que** des migrations
TypeScript natives. La règle (« aucun SQL brut dans une migration ») est inscrite
**dans le code**, appliquée à trois niveaux, et vérifiable par des audits
automatisés.

Cette PR couvre l'ensemble de la branche : elle contient le chantier
« migrations TypeScript only » (14 derniers commits) **et** les travaux
antérieurs de la branche (moteur, CLI, packages applicatifs).

## Changes

### Le contrat, dans le code

`packages/migrations/src/migration.ts` :

```ts
export const LEGACY_SQL_FIELDS = [
  "content", "down", "kind", "rawSql", "downRawSql",
] as const;

assertTypeScriptNativeMigration(candidate, migrationId); // throws MigrationError
```

Appliqué avant toute compilation ou exécution :

| Niveau | Point d'entrée |
|---|---|
| `MigrationRegistry.register()` | `loadMigration()` — `registry.ts:57` |
| `MigrationValidator.validate()` | `validator.ts:175` |
| `MigrationCompiler.compileUpAsync()` / `compileDownAsync()` | `compiler.ts:114/143/162` |

Le dernier échappement SQL du package, `raw()` (équivalent Laravel
`DB::raw()`), est **supprimé de l'API** : ses usages ont migré vers
`func("now")`.

### Le DSL

- `context.schema` : 22 blueprints (tables, index, schémas, contraintes,
  `ALTER COLUMN`, fonctions, triggers).
- `context.data` : `insert`, `insertSelect`, `update`, `delete`.
- Modèle d'expressions fermé et structuré ; une seule notion de requête
  (`select` / `subquery`).
- `createFunction` / `createTrigger` : **unique exception assumée** — un corps
  PL/pgSQL (du code de fonction), jamais une commande SQL. Typé
  (`TrustedFunctionBody`), documenté, PostgreSQL uniquement.
- Le Planner reste la frontière de compilation : le plan porte le SQL compilé,
  donc le preview est exactement ce qui est exécuté.

### Les migrations

**84 fichiers de migration** convertis au DSL : 46 migrations applicatives et
shell, plus leurs registres (`ManifestMigrationProvider` remplace les providers
maison de `bac-migrations.ts`).

### Les garde-fous

`scripts/migrations/` — quatre audits comparent les migrations à leur référence
historique, **figée** dans `historical-ref.ts` (`8507d6d`, la dernière révision
portant le SQL historique) pour rester efficaces après le commit :

```bash
pnpm audit:migrations
```

| Audit | Garantit |
|---|---|
| `audit-nullability` | une colonne historiquement nullable l'est toujours (le DSL rend `NOT NULL` par défaut) |
| `audit-types` | les types de colonnes n'ont pas dérivé (`VARCHAR(255)` → `TEXT` ?) |
| `audit-tables` | les références de table sont des noms, pas des fragments SQL |
| `audit-sql-equivalence` | le SQL généré est sémantiquement identique |

## Impact

- **Breaking** pour toute migration qui déclarait `content` / `down` /
  `rawSql` : le moteur les refuse désormais. `legacyChecksums` préserve la
  continuité pour les bases déjà migrées (le checksum historique reste accepté
  dans le ledger).
- `file-provider.ts` (scan du filesystem) est supprimé : la découverte passe
  par les manifestes.
- La CLI génère désormais un **module TypeScript** (`up(context)` /
  `downMigration(context)`) et non un script SQL.

## Validation

| Vérification | Résultat |
|---|---|
| `pnpm audit:migrations` | 0 écart · 0 anomalie · 0 divergence |
| `vitest run packages/migrations packages/adapters/database-sqlite apps/solidarity tests/production/migrations-concurrency.e2e.test.ts` | **168 / 168** |
| `tsc --build tsconfig.build.json` | **0 erreur** (hors 2 packages pré-existants manquants : `@mosaix/otp`, `@mosaix/ports-crypto`) |
| `eslint` sur le périmètre migré | **0 erreur** |
| `pnpm check:migration-checksums` | stable |
| `vitest run` (suite complète) | 1398 passés / 23–25 échecs |

Les 23–25 échecs de la suite complète sont **préexistants** : rejoués sur
`8507d6d` (HEAD vierge, `git stash`), les mêmes fichiers échouent déjà. Ce sont
des tests d'isolation PostgreSQL (`*-pg-isolation`, `portfolio-multi-tenant`,
`space-isolation`) et des tests hors périmètre (command-center TUI,
theme-bridge « DEMONSTRATES BUG », conformance). Les 3 échecs
`adapters/database-sqlite` qu'ils provoquaient **étaient** imputables à ce
chantier (le test déclarait encore des migrations en `rawSql`) : ils sont
corrigés.

## Bugs réels corrigés

Trouvés par la vérification (comparateur SQL + audits), pas par la relecture :

1. **27 colonnes** historiquement nullables rendues `NOT NULL` — schéma plus strict que la base déployée, INSERT refusés.
2. **6 références de table corrompues** (`data.update("UPDATE schema.table", …)`) — erreur à l'exécution.
3. `ADD COLUMN "capacity" INTEGER DEFAULT 1` rendu `TEXT` — type **et** default perdus.
4. `isNull` / `isNotNull` **inversés** dans 2 migrations — condition inversée.
5. Regex sur-échappée (`^\\d` au lieu de `^\d`) — aucun motif ne matchait.
6. `ALTER COLUMN … TYPE VARCHAR(255)` rendu `TEXT` dans le rollback — le rollback ne restaurait pas le type.
7. `REFERENCES "vendables"` sans le schéma — FK vers une table inexistante.
8. `DEFAULT '[]'` perdu sur `auditTrail`.
9. `TIMESTAMP` rendu `TIMESTAMP WITH TIME ZONE`.
10. Rollback dupliqué sur la migration citadelle (pas de `down` historique) — le rollback **re-créait** les tables.

## Risks

- **Commits intermédiaires non verts** : le moteur supprime `rawSql` avant que
  les applications soient converties. La branche n'est fusionnable qu'après
  le commit des applications.
- **Diff volumineux** : la branche contient 293 commits (dont 279 antérieurs à
  ce chantier : CLI, moteur, packages applicatifs). La relecture du moteur seul
  est conseillée en priorité — c'est la partie qui porte la rupture.
- **Flakiness PostgreSQL** : les tests d'isolation se disputent la même base
  (`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`).
  Préexistant, mais il fait osciller le nombre d'échecs de la suite entre 23 et
  25 selon le plan de parallélisation.
- `createFunction` reste une exception : un corps PL/pgSQL est du texte. Typé
  et PostgreSQL-only, mais c'est la seule surface non structurée.

## Rollback

```bash
git revert <hash>            # un commit précis
git reset --hard 8507d6d     # retour à l'état d'avant le chantier
```

Les checksums historiques restent acceptés via `legacyChecksums` : une base
déjà migrée n'est pas rejetée par le Planner.

## Traçabilité

- Rapport de session : `.project/reports/session-2026-11-11.md`
- Workflow de conversion : `.project/workflows/maintenance/migration-conversion.md`
- Revue d'architecture : ChatGPT (arbitrages D1/D2/D3, GO définitif)
