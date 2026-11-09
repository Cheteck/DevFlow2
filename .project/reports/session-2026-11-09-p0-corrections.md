# Rapport de session — Corrections P0 Phase 04

**Date :** 2026-11-09  
**Branche :** fix/p0-migration-contracts  
**Commit :** e6bd694

---

## Objectif

Appliquer les corrections P0 obligatoires définies dans la décision de revue Phase 04, et préparer les contrats Phase 05 (documentation uniquement).

---

## Travaux réalisés

### P0.1 — Détection des collisions de ressources (`validateNoResourceCollision`)

**Correction :** La collision n'est signalée que lorsque les `ownerId` sont différents. Une même ressource déclarée par deux migrations du même owner est désormais autorisée (évolution). `rawSql.resources` est traité comme un sous-ensemble de `migration.resources` (déduplication, pas de faux positif).

**Tests ajoutés :**
- Même ressource dans `resources` et `rawSql.resources` d'une même migration : pas de faux positif
- Même ressource dans deux migrations du même owner : autorisé
- Même ressource dans deux owners différents : collision détectée
- Deux ressources différentes : aucune collision

### P0.2 — Intégration rawSql dans le chemin canonique (`compileUpAsync`)

**Correction :** `compileUpAsync()` est désormais le chemin canonique de compilation `up` (intègre automatiquement rawSql). `compileUpWithRawSql()` est un alias temporaire. `compileDownAsync()` documente qu'il n'y a pas de rollback automatique via rawSql.

**Tests ajoutés :**
- `compileUpAsync()` retourne les blueprints et rawSql
- Migration sans rawSql conserve son comportement
- Instructions rawSql après les blueprints (ordre contractuel)
- Chemin synchrone et asynchrone produisent le même résultat

### P0.3 — Cohérence des dialectes

**Correction :** Le `MigrationCompiler` vérifie à la construction la cohérence entre le dialecte du Compiler, de la Grammar et du Runtime. La `Grammar` gagne une propriété `dialect`. Le `validateRawSqlDialect()` rejette explicitement un rawSql incompatible.

**Tests ajoutés :**
- Compiler PostgreSQL + rawSql PostgreSQL : accepté
- Compiler SQLite + rawSql SQLite : accepté
- Compiler PostgreSQL + rawSql SQLite : rejeté
- Compiler SQLite + rawSql PostgreSQL : rejeté
- `both` accepté par les deux compilateurs
- Grammar dialect incohérent : erreur à la construction
- Runtime dialect incohérent : erreur à la construction

### P0.4 — Matrice stricte des modes de migration

**Correction :** `MigrationValidator.validate()` applique désormais une matrice stricte (kind/up/content/down/downMigration/rawSql/checksum). Toute combinaison non prévue est rejetée explicitement.

**Tests ajoutés :** 9 cas couvrant toutes les combinaisons de la matrice.

### P0.5 — Validation bloque l'exécution

**Correction :** `MigrationValidator.validateBatch()` ajouté pour l'enregistrement atomique du Registry. Le `Registry.register()` valide tout le lot avant toute modification des structures internes. Si une seule migration est invalide, aucune n'est enregistrée.

**Test d'intégration ajouté :** Une migration invalide (kind "sql" sans `content`) est rejetée par le Registry avant d'atteindre le Planner et le Runner.

### P1.1-P1.5 — Corrections préparatoires

- `parseMigrationId()` : support des versions pointées, rejet des segments vides, `Number.isSafeInteger()` pour la séquence
- Validator : dépendances dupliquées rejetées, params rawSql typés (valeurs primitives), SQL brut vide rejeté, ressources rawSql sans `migration.resources` rejeté
- Registry : vérification de cohérence entre `provider.ownerId()` et l'owner déclaré dans l'ID de migration

---

## Fichiers modifiés (commit e6bd694)

| Fichier | Modification |
|---|---|
| `packages/migrations/src/compiler.ts` | assertTypeScript ajouté, canonical compileUpAsync, dialect consistency check, compileUpWithRawSql alias |
| `packages/migrations/src/compiler.test.ts` | Tests rawSql, dialect consistency, sync/async equivalence |
| `packages/migrations/src/grammar.ts` | Propriété `dialect` sur SQLiteGrammar et PostgresGrammar |
| `packages/migrations/src/index.test.ts` | Ressources par défaut, tests intégration validation bloque exécution |
| `packages/migrations/src/index.ts` | Exports (déjà présents, non modifiés dans cette session) |
| `packages/migrations/src/migration.ts` | parseMigrationId corrigé (versions pointées, segments vides, isSafeInteger) |
| `packages/migrations/src/migration-context.ts` | (Phase 04, non modifié dans cette session) |
| `packages/migrations/src/migration-context.test.ts` | Checksum explicite pour migration TypeScript, rawSql en kind typescript |
| `packages/migrations/src/planner.ts` | Collision de ressources par owner (même owner = évolution autorisée) |
| `packages/migrations/src/registry.ts` | Enregistrement atomique (validateBatch avant mutation) |
| `packages/migrations/src/runner.ts` | Guard content undefined dans applyUp, previewSQL gère undefined |
| `packages/migrations/src/schema-builder.test.ts` | Ressources par défaut |
| `packages/migrations/src/validator.ts` | Matrice stricte, validateBatch, rawSql validation renforcée, dépendances dupliquées |
| `packages/migrations/src/validator.test.ts` | 13 tests supplémentaires (collisions, matrice stricte) |
| `src/shell/bac-migrations.ts` | Guard content undefined |

### Nouveaux fichiers (ADR Phase 05 — documentation uniquement)

| Fichier | Objet |
|---|---|
| `.project/decisions/ADR-0027-runtime-contract.md` | Contrat Runtime |
| `.project/decisions/ADR-0028-store-contract.md` | Contrat Store |
| `.project/decisions/ADR-0029-integration-contract.md` | Contrat d'intégration |
| `.project/decisions/ADR-0030-contract-tests-phase05.md` | Tests contractuels |

---

## Résultats de validation

- **Tests migrations :** 103/103 passés (5 fichiers de test)
- **`tsc --noEmit` :** 0 erreur dans `packages/migrations/` (erreurs pré-existing uniquement dans `packages/command-center/`, non liées)
- **Périmètre interdit :** Aucun élément du Runner, du Store, des migrations historiques, du transfert `user_subscriptions` ou des providers BACs n'a été modifié.

---

## Git State

- Branche active : `fix/p0-migration-contracts`
- Commit avant : `0d6a5ba`
- Commit après : `e6bd694`
- Commits créés : 1 (`e6bd694 fix(migrations): P0 corrections for Compiler/Validator contracts`)
- Rollback disponible : `git revert e6bd694` ou `git reset --hard 0d6a5ba`

---

## Prochaines actions

1. Attendre la relecture et validation des contrats Phase 05 (ADR-0027 à ADR-0030).
2. Une fois les contrats validés, implémenter le Runtime et le Store (Phase 05).
3. Ne pas migrer les providers BACs avant validation des corrections P0 et revue des contrats.

---
*Rapport produit conformément au protocole Autonomous Engineering Steward.*