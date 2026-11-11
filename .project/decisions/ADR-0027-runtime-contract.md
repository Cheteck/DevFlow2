# ADR-0027 — Contrat Runtime (Phase 05)

**Date :** 2026-11-09  
**Statut :** Proposition (préparation contractuelle Phase 05 — aucune implémentation)  
**Décideurs :** Architecture Steward  
**Lié à :** ADR-0006, ADR-0025, ADR-0026, PRD-0006

---

## 1. Contexte

La Phase 04 a implémenté le `MigrationCompiler` et le `MigrationValidator`. La Phase 05 doit sécuriser le Runtime et le Store. Avant toute implémentation, le contrat Runtime doit être figé.

Le Runtime est l'entité qui fournit au Compiler les informations d'exécution (dialecte, capacités) et qui, à terme, exécutera les migrations compilées.

**Restriction :** Aucune modification du `MigrationRunner` ni du `MigrationStore` existant durant cette phase préparatoire.

---

## 2. Responsabilités du Runtime

| Responsabilité | Description |
|---|---|
| Fournir le dialecte | Le dialecte SQL effectif (`sqlite` | `postgres`) utilisé pour la compilation et l'exécution. |
| Déclarer les capacités | `transactions`, `lock` (distributed, processSafe, runtimeSafe). |
| Valider la compatibilité | Le dialecte du Runtime doit correspondre au dialecte du Compiler et de la Grammar. |
| Fournir le contexte d'exécution | `MigrationContext` passé aux fonctions `up()` / `downMigration()` des migrations TypeScript natives. |

---

## 3. Interface `MigrationRuntime`

Définie dans `packages/migrations/src/migration-context.ts` :

```ts
export interface MigrationRuntime {
  readonly dialect: "sqlite" | "postgres";
  readonly capabilities: {
    readonly transactions: boolean;
    readonly lock: {
      readonly distributed: boolean;
      readonly processSafe: boolean;
      readonly runtimeSafe: boolean;
    };
  };
}
```

Le `dialect` doit être cohérent avec celui du `MigrationCompiler` et de la `Grammar` (vérifié à la construction du Compiler, Phase 04 P0).

---

## 4. Dialecte et capacités

| Dialect | Capacités typiques | Usage |
|---|---|---|
| `sqlite` | `transactions: true`, `lock.distributed: false`, `lock.processSafe: true`, `lock.runtimeSafe: true` | Développement, offline-first, WASM |
| `postgres` | `transactions: true`, `lock.distributed: true`, `lock.processSafe: true`, `lock.runtimeSafe: true` | Production multi-instance |

**Règle :** Le dialecte du Runtime est déterminé par l'adaptateur de stockage, pas par la migration. Une migration déclare un `rawSql.dialect` compatible avec le dialecte courant, jamais l'inverse.

---

## 5. Limites d'exécution

| Limite | Description |
|---|---|
| Pas d'exécution SQL directe | Le Runtime ne fournit pas de connexion SQL brute aux migrations. Les instructions SQL brutes passent par `rawSql`, déclarées explicitement. |
| Pas de rollback automatique | Si aucune `downMigration` n'est déclarée, la migration est irréversible. |
| Transactions | Déléguées à l'adaptateur de stockage via `DatabasePort.acquireMigrationLock()` et `DatabasePort.transaction()`. |
| Verrous | Responsabilité de l'adaptateur (R3 du ADR-0006), jamais du Runtime ni du Runner. |

---

## 6. Gestion des erreurs

| Erreur | Signification |
|---|---|
| `MigrationLockError` | Le verrou de migration n'a pas pu être acquis. |
| `MigrationTransactionError` | Échec de début/commit/rollback de transaction. |
| `MigrationExecutionError` | Échec d'exécution SQL d'une migration. |

---

## 7. Conséquences

- Le `MigrationCompiler` vérifie la cohérence dialecte Compiler/Grammar/Runtime à la construction (Phase 04 P0).
- Le `MigrationValidator` rejette les `rawSql` dont le dialecte est incompatible avec le dialecte courant (Phase 04 P0).
- Le Runtime ne fabrique pas de capacités par défaut pour faire passer la compilation.
- Aucune implémentation de `MigrationRuntime` concrète n'est créée durant cette phase préparatoire (documentation uniquement).

---

## 8. Critères de sortie

- [ ] Le contrat `MigrationRuntime` est documenté et relu.
- [ ] Les capacités disponibles et interdites pendant la compilation sont listées ci-dessus.
- [ ] Aucun code du Runner ni du Store n'a été modifié.

---

## 9. Alternatives considérées

1. **Runtime avec capacités par défaut** — Rejeté : masquerait des incompatibilités dialecte/capacités et violerait le principe de non-fabrication de capacités.
2. **Runtime responsable du verrouillage** — Rejeté : la garantie de concurrence appartient à l'adaptateur de stockage (ADR-0006, R3).

---

*ADR produit dans le cadre de la préparation contractuelle Phase 05. Aucun code modifié.*