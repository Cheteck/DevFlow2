# ADR-0029 — Contrat d'intégration Planner → Compiler → Runtime → Store (Phase 05)

**Date :** 2026-11-09  
**Statut :** Proposition (préparation contractuelle Phase 05 — aucune implémentation)  
**Décideurs :** Architecture Steward  
**Lié à :** ADR-0006, ADR-0025, ADR-0026, ADR-0027, ADR-0028, PRD-0006

---

## 1. Contexte

La Phase 04 a implémenté le `MigrationCompiler` et le `MigrationValidator`. La Phase 05 doit sécuriser le Runtime et le Store. Avant toute implémentation, le contrat d'intégration entre les composants doit être figé.

Le pipeline d'intégration est :

```text
Registry (état désiré)
    ↓
Migration Planner (décide : delta, ordre, collisions)
    ↓
Migration Compiler (compile les blueprints en SQL via la Grammar)
    ↓
Migration Runtime (fournit dialecte et capacités)
    ↓
Migration Store (enregistre l'état appliqué)
    ↓
Migration Runner (exécute le plan — existant, non modifié)
```

**Restriction :** Aucune modification du `MigrationRunner` ni du `MigrationStore` existant durant cette phase préparatoire. Le contrat d'intégration est documentaire uniquement.

---

## 2. Interaction Planner → Compiler → Runtime → Store

### 2.1 Planner

Le Planner reçoit le `MigrationRegistry` (providers agrégés) et le `MigrationStore` (état actuel). Il :

1. Récupère les migrations désirées depuis le Registry.
2. Récupère les migrations exécutées depuis le Store.
3. Vérifie la cohérence du store (migrations orphelines, checksums modifiés).
4. Détecte les collisions de ressources SQL entre les opérations planifiées.
5. Produit un `MigrationPlan` immuable avec les opérations `up` / `down`.

**Point d'entrée canonique :** `MigrationPlanner.plan(options?)`.

### 2.2 Compiler

Le Compiler reçoit une `Grammar`, un `dialect` et un `MigrationRuntime`. Il :

1. Vérifie à la construction la cohérence dialecte Compiler/Grammar/Runtime.
2. Compile les blueprints produits par `up()` / `downMigration()` via la Grammar.
3. Intègre automatiquement les instructions `rawSql` (après les blueprints, dans l'ordre contractuel).
4. Retourne un `CompilationResult` dont le `dialect` correspond au dialecte effectif des instructions compilées.

**Chemin canonique :** `compileUpAsync()` (Phase 04 P0). `compileUpWithRawSql()` est un alias temporaire.

### 2.3 Runtime

Le Runtime fournit :
- Le `dialect` effectif (`sqlite` | `postgres`).
- Les `capabilities` (transactions, lock).

Le dialecte du Runtime doit correspondre à celui du Compiler et de la Grammar.

### 2.4 Store

Le Store enregistre chaque migration appliquée avec son `id`, `owner`, `checksum`, `batchId` et `appliedAt`. Il est la source de vérité de l'état actuel.

---

## 3. Ordre des opérations

Pour une invocation d'exécution (upgrade) :

```text
1. Registry.all()                     → liste des migrations désirées
2. Store.list()                       → liste des migrations appliquées
3. Planner.assertStoreConsistent()    → vérifie orphelins et checksums
4. Planner.buildPlan()                → calcule le delta (opérations up/down)
5. Planner.assertNoResourceCollisions() → détecte les collisions SQL
6. Planner.plan()                     → retourne MigrationPlan immuable
7. Runner.run(plan)                   → exécute le plan (existant, non modifié)
   7a. Acquérir le verrou de migration
   7b. Pour chaque opération up : compiler (si TypeScript) → exécuter → Store.save()
   7c. Pour chaque opération down : exécuter down() → Store.remove()
   7d. Libérer le verrou (finally)
```

**Le Planner ne compile pas lui-même : il décide. Le Runner exécute uniquement le plan validé.**

---

## 4. Gestion des échecs

| Échec | Composant détecteur | Action |
|---|---|---|
| Migration invalide | `MigrationValidator` (appelé par Registry.register avant enregistrement) | `MigrationValidationError`, aucune migration enregistrée (atomicité) |
| Collision d'identité | `MigrationRegistry.register` | `MigrationConflictError`, aucune migration enregistrée |
| Collision de ressources | `MigrationPlanner.assertNoResourceCollisions` | `MigrationResourceConflictError`, plan bloqué |
| Checksum modifié | `MigrationPlanner.assertStoreConsistent` | `MigrationChecksumError`, plan bloqué |
| Migration orpheline | `MigrationPlanner.assertStoreConsistent` | `MigrationMissingError`, plan bloqué |
| Verrou non acquis | Adaptateur de stockage | `MigrationLockError` |
| Échec d'exécution SQL | `MigrationRunner.applyUp` / `applyDown` | `MigrationExecutionError`, transaction rollback |
| Échec de transaction | Adaptateur de stockage | `MigrationTransactionError` |

**Règle :** Toute validation qui échoue interdit toute poursuite. Aucune exécution n'a lieu si une validation échoue.

---

## 5. Garanties transactionnelles

| Garantie | Description |
|---|---|
| Atomicité par migration | SQL + `store.save()` dans la même transaction (quand l'adaptateur le supporte). Si `store.save()` échoue, le SQL est rollbacké. |
| Atomicité du batch | Toutes les migrations d'une invocation partagent le même `batchId`. Un échec n'annule pas les migrations déjà réussies du batch (comportement actuel préservé). |
| Libération du verrou | Le verrou est toujours libéré dans un `finally`, même en cas d'erreur. |
| Rollback | Chaque opération `down` est exécutée dans sa propre transaction. `store.remove()` est appelé après exécution du SQL de rollback. |

---

## 6. Comportement des migrations irréversibles

| Cas | Comportement |
|---|---|
| Pas de `downMigration` | `compileDownAsync()` retourne `undefined`. La migration est considérée comme irréversible. |
| Pas de `down` (mode SQL) | Le Planner ignore la migration pour le rollback (`continue` dans `buildRollbackPlan`). |
| Pas de `rawSql` inverse | Il n'y a pas de rollback automatique via `rawSql`. Les instructions `rawSql` sont définies pour la phase `up` uniquement. |

**Règle :** Si aucune instruction inverse n'est déclarée, la migration reste irréversible. Le Runtime ne fabrique pas de rollback automatique.

---

## 7. Conséquences

- Le `MigrationValidator` est invoqué par le `MigrationRegistry.register` avant toute modification des structures internes (atomicité Phase 04 P1.2).
- Le `MigrationCompiler` vérifie la cohérence dialecte à la construction (Phase 04 P0).
- Le `compileUpAsync()` est le chemin canonique de compilation `up` (Phase 04 P0).
- Le `compileDownAsync()` n'intègre pas les instructions `rawSql` (Phase 04 P0).
- Aucun code du `MigrationRunner` ni du `MigrationStore` n'est modifié durant cette phase (restriction Phase 05).
- Aucune implémentation concrète du Runtime ou du Store n'est créée durant cette phase (documentation uniquement).

---

## 8. Critères de sortie

- [ ] L'ordre des opérations est documenté ci-dessus.
- [ ] La gestion des échecs est définie pour chaque composant.
- [ ] Les garanties transactionnelles sont listées ci-dessus.
- [ ] Le comportement des migrations irréversibles est spécifié.
- [ ] Aucun code du Runner ni du Store n'a été modifié.

---

## 9. Alternatives considérées

1. **Compilation dans le Planner** — Rejeté : séparerait mal les responsabilités (Planner décide, Compiler compile).
2. **Rollback automatique via rawSql** — Rejeté : les instructions `rawSql` sont définies pour la phase `up` uniquement ; pas de rollback automatique.
3. **Verrouillage dans le Runner** — Rejeté : la garantie de concurrence appartient à l'adaptateur de stockage (ADR-0006, R3).

---

*ADR produit dans le cadre de la préparation contractuelle Phase 05. Aucun code modifié.*