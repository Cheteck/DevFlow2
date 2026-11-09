# ADR-0028 — Contrat Store (Phase 05)

**Date :** 2026-11-09  
**Statut :** Proposition (préparation contractuelle Phase 05 — aucune implémentation)  
**Décideurs :** Architecture Steward  
**Lié à :** ADR-0006, ADR-0025, ADR-0026, PRD-0006

---

## 1. Contexte

La Phase 04 a implémenté le `MigrationCompiler` et le `MigrationValidator`. La Phase 05 doit sécuriser le Runtime et le Store. Avant toute implémentation, le contrat Store doit être figé.

Le Store est la source de vérité de l'état appliqué des migrations. Il enregistre chaque migration exécutée avec son identifiant, son propriétaire, son checksum et son identifiant de batch.

**Restriction :** Aucune modification du `MigrationStore` ni du `MigrationRunner` existant durant cette phase préparatoire.

---

## 2. Responsabilités du Store

| Responsabilité | Description |
|---|---|
| Persistance des migrations appliquées | Enregistrer chaque migration exécutée (`ExecutedMigration`). |
| Source de vérité | L'état réel des migrationsappliquées réside dans le Store. Le Planner compare le Registry (état désiré) contre le Store (état actuel). |
| Immutabilité | Une migration appliquée ne peut jamais être réécrite ou modifiée. |
| Historique et statut | Conserver l'ordre d'application, les identifiants de batch, les timestamps. |
| Gestion des checksums | Enregistrer le checksum au moment de l'exécution pour détecter toute modification ultérieure. |
| Garanties de concurrence | Le verrouillage est délégué à l'adaptateur de stockage, pas au Store. |

---

## 3. Interface `MigrationStore`

Définie dans `packages/migrations/src/store.ts` :

```ts
export interface ExecutedMigration {
  readonly id: string;
  readonly owner: string;
  readonly checksum: string;
  readonly batchId: string;
  readonly appliedAt: Date;
}

export interface MigrationStore {
  list(): Promise<readonly ExecutedMigration[]>;
  get(id: string): Promise<ExecutedMigration | undefined>;
  save(migration: ExecutedMigration): Promise<void>;
  remove(id: string): Promise<void>;
}
```

`list()` doit retourner les migrations dans l'ordre d'application (plus ancien en premier) pour permettre au Planner de rollback en ordre inverse (PRD §29).

---

## 4. Structure des migrations enregistrées

Chaque entrée `ExecutedMigration` contient :

| Champ | Type | Description |
|---|---|---|
| `id` | `string` | Identifiant canonique `owner.module.version.sequence_name` |
| `owner` | `string` | Propriétaire de la migration (premier segment de l'ID) |
| `checksum` | `string` | Checksum calculé au chargement/exécution (R2) |
| `batchId` | `string` | Identifiant de batch (toutes les migrations d'une même invocation partagent le même batchId, PRD §30) |
| `appliedAt` | `Date` | Timestamp d'application |

---

## 5. Gestion des checksums

| Règle | Description |
|---|---|
| Calcul au chargement | Le checksum est calculé par `loadMigration()` (Phase 03/04) au moment où la migration est chargée depuis le Registry. |
| Enregistrement à l'exécution | Le checksum est enregistré dans le Store au moment où la migration est appliquée (R2). |
| Détection de modification | Le Planner vérifie que le checksum du Registry correspond au checksum du Store pour toute migration déjà appliquée (`MigrationChecksumError`). |
| Immutabilité | Une migration déjà enregistrée dans le Store ne peut pas être réenregistrée (`save()` sur un ID existant doit lever `MigrationAlreadyAppliedError`). |

---

## 6. Historique et statut des migrations

| Statut | Signification |
|---|---|
| Non appliquée | Présente dans le Registry, absente du Store. |
| Appliquée | Présente dans le Registry et dans le Store, checksums concordants. |
| Modifiée après application | Présente dans les deux, checksums différents (`MigrationChecksumError`, bloquant). |
| Orpheline | Présente dans le Store, absente du Registry (`MigrationMissingError`, bloquant, R5). |

---

## 7. Garanties d'intégrité et de concurrence

| Garantie | Mécanisme |
|---|---|
| Atomique par migration | Chaque opération s'exécute dans une transaction (quand l'adaptateur le supporte) : SQL + `store.save()` dans la même transaction. |
| Verrou de migration | Acquis avant toute exécution, libéré dans un `finally` (responsabilité de l'adaptateur via `DatabasePort.acquireMigrationLock()`). |
| Batch | Toutes les migrations exécutées par une même invocation du Runner partagent le même `batchId` (PRD §30). |
| Rollback en ordre inverse | Le Planner sélectionne les migrations à rollback en ordre inverse d'application (PRD §29). |

---

## 8. Conséquences

- `SqlMigrationStore.save()` doit utiliser un `INSERT` strict (pas d'upsert `ON CONFLICT DO UPDATE`), et lever `MigrationAlreadyAppliedError` si l'ID existe déjà.
- `SqlMigrationStore.remove()` doit vérifier que la migration existe avant de la supprimer, et lever `MigrationMissingError` sinon.
- Aucune implémentation concrète de `MigrationStore` n'est créée ou modifiée durant cette phase préparatoire (documentation uniquement).
- Le `MigrationRunner` existant n'est pas modifié (restriction Phase 05).

---

## 9. Critères de sortie

- [ ] Le contrat `MigrationStore` est documenté et relu.
- [ ] La structure des migrations enregistrées est définie ci-dessus.
- [ ] Les garanties d'intégrité (immutabilité, checksums, concurrence) sont listées ci-dessus.
- [ ] Aucun code du Runner ni du Store n'a été modifié.

---

## 10. Alternatives considérées

1. **Upsert `ON CONFLICT DO UPDATE`** — Rejeté : permettrait de réécrire une migration déjà appliquée, contredisant l'immutabilité (R2).
2. **Suppression silencieuse dans `remove()`** — Rejeté : masquerait des erreurs d'état. `remove()` doit lever `MigrationMissingError` si l'ID n'existe pas.

---

*ADR produit dans le cadre de la préparation contractuelle Phase 05. Aucun code modifié.*