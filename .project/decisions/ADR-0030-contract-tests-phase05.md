# ADR-0030 — Tests contractuels Phase 05

**Date :** 2026-11-09  
**Statut :** Proposition (préparation contractuelle Phase 05 — aucune implémentation)  
**Décideurs :** Architecture Steward  
**Lié à :** ADR-0027, ADR-0028, ADR-0029, PRD-0006

---

## 1. Contexte

Avant de commencer l'implémentation de la Phase 05 (Runtime et Store), les tests contractuels doivent être définis. Ces tests couvrent :

- Scénarios nominaux
- Échecs et reprises
- Doublons et conflits
- Compatibilité des dialectes
- Cohérence entre plan, compilation et persistance

**Restriction :** Ces tests sont documentés ici mais n'implémentent aucune modification du Runner ni du Store existant.

---

## 2. Scénarios nominaux

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-N01 | Migration TypeScript native (`kind: "typescript"`, `up`, checksum) compilée via `compileUpAsync()` | `CompilationResult` avec statements et dialect cohérent |
| T05-N02 | Migration SQL legacy (`kind: "sql"`, `content`) compilée via `compileSql()` | Une seule statement avec le SQL tel quel |
| T05-N03 | Migration sans `rawSql` | Même comportement qu'avant (pas de régression) |
| T05-N04 | Migration avec `rawSql` dialect `both` | Accepté par les deux compilateurs (SQLite et PostgreSQL) |
| T05-N05 | Plan avec plusieurs migrations du même owner sur la même ressource | Pas de collision (évolution autorisée) |
| T05-N06 | Migration irréversible (pas de `downMigration`) | `compileDownAsync()` retourne `undefined` |
| T05-N07 | Enregistrement atomique d'un batch de migrations valides | Toutes les migrations enregistrées |

---

## 3. Échecs et reprises

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-E01 | Migration invalide enregistrée via `Registry.register` | `MigrationValidationError`, aucune migration du lot enregistrée (atomicité) |
| T05-E02 | Collision d'identité entre deux providers | `MigrationConflictError`, aucune migration enregistrée |
| T05-E03 | Collision de ressources entre owners différents | `MigrationResourceConflictError` |
| T05-E04 | `save()` sur une migration déjà appliquée | `MigrationAlreadyAppliedError` |
| T05-E05 | `remove()` sur une migration inexistante | `MigrationMissingError` |
| T05-E06 | Migration orpheline (dans le Store, absente du Registry) | `MigrationMissingError` au plan |
| T05-E07 | Checksum modifié après application | `MigrationChecksumError` au plan |
| T05-E08 | Échec de verrou de migration | `MigrationLockError` |

---

## 4. Doublons et conflits

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-D01 | Même ressource dans `resources` et `rawSql.resources` d'une même migration | Pas de faux positif |
| T05-D02 | Même ressource dans deux migrations du même owner | Autorisé (évolution) |
| T05-D03 | Même ressource dans deux owners différents | Collision détectée |
| T05-D04 | Dépendance dupliquée dans `dependencies[]` | Rejetée par le Validator |
| T05-D05 | Dépendance sur soi-même | Rejetée par le Validator |
| T05-D06 | Segment vide dans un ID de migration | Rejeté par `parseMigrationId` |

---

## 5. Compatibilité des dialectes

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-DL01 | Compiler PostgreSQL + rawSql PostgreSQL | Accepté |
| T05-DL02 | Compiler SQLite + rawSql SQLite | Accepté |
| T05-DL03 | Compiler PostgreSQL + rawSql SQLite | Rejeté (incohérence de dialecte) |
| T05-DL04 | Compiler SQLite + rawSql PostgreSQL | Rejeté (incohérence de dialecte) |
| T05-DL05 | rawSql dialect `both` | Accepté par les deux compilateurs |
| T05-DL06 | Grammar dialect ≠ Compiler dialect | Erreur à la construction du Compiler |
| T05-DL07 | Runtime dialect ≠ Compiler dialect | Erreur à la construction du Compiler |

---

## 6. Cohérence entre plan, compilation et persistance

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-C01 | Plan généré, puis compilation de chaque opération `up` | Les statements compilés correspondent aux opérations planifiées |
| T05-C02 | Migration appliquée et enregistrée dans le Store | `Store.get(id)` retourne l'entrée avec le bon checksum |
| T05-C03 | Rollback d'une migration | `Store.remove(id)` supprime l'entrée, la migration redevient non appliquée |
| T05-C04 | Deux invocations du Planner avec le même état | Même plan (idempotence, R14) |
| T05-C05 | Migration avec `rawSql` dialect incompatible | Rejeté avant toute exécution (validation bloque) |
| T05-C06 | `compileUpAsync()` et `compileUp()` produisent le même résultat | Même statements et même dialect |

---

## 7. Intégration : validation bloque l'exécution

| ID | Scénario | Résultat attendu |
|---|---|---|
| T05-I01 | Migration invalide (kind "sql" sans `content`) | Rejetée par `Registry.register` avant d'atteindre le Planner |
| T05-I02 | Migration non enregistrée | Le Planner ne peut pas la planifier |
| T05-I03 | Migration invalide rejetée | Le Runner ne reçoit aucun plan contenant cette migration |

**Preuve attendue :** Un test d'intégration démontrant qu'une migration invalide ne peut pas atteindre l'étape d'exécution (voir `packages/migrations/src/index.test.ts` — "integration — validation blocks execution").

---

## 8. Critères de sortie

- [ ] Tous les scénarios nominaux passent.
- [ ] Tous les scénarios d'échec et de reprise passent.
- [ ] Tous les scénarios de doublons et conflits passent.
- [ ] Tous les scénarios de compatibilité des dialectes passent.
- [ ] Tous les scénarios de cohérence plan/compilation/persistance passent.
- [ ] Le test d'intégration "validation bloque l'exécution" passe.
- [ ] `tsc --noEmit` ne signale aucune erreur dans les fichiers modifiés.
- [ ] Aucun code du Runner ni du Store n'a été modifié.

---

## 9. Emplacement des tests

Les tests unitaires sont dans :
- `packages/migrations/src/validator.test.ts` (règles de validation, matrice stricte, collisions de ressources)
- `packages/migrations/src/compiler.test.ts` (rawSql, dialecte, cohérence synchrone/asynchrone)
- `packages/migrations/src/index.test.ts` (intégration : validation bloque l'exécution, atomique du Registry)

Les tests contractuels Phase 05 (Runtime, Store) sont documentés ici mais n'implémentent aucune modification du Runner ni du Store.

---

*ADR produit dans le cadre de la préparation contractuelle Phase 05. Aucun code modifié.*