# Préparation Phase 05 — Sécurisation du Runtime et du Store

**Date :** 2026-11-09  
**Phase :** 05 — Sécurisation du Runtime et du Store (P0 — Bloquant)  
**Statut :** PRÉPARATION UNIQUEMENT (aucune modification du Runner ni du Store)  
**Autorisation :** ChatGPT a autorisé la préparation de la Phase 05, mais interdit toute modification du Runner, du Store, des migrations historiques et des providers BACs.  
**Prérequis :** La Phase 04 doit être certifiée définitivement (corrections P0/P1 en cours) avant toute implémentation de la Phase 05.

---

## 1. Analyse de l'existant (lecture seule)

### 1.1 MigrationRunner (`packages/migrations/src/runner.ts`)

| Composant | Implémentation actuelle | Risque identifié | Gravité |
|-----------|------------------------|------------------|---------|
| `applyUp()` | `db.transaction()` : SQL + `store.save()` dans la même transaction | ✅ Atomique : si Store.save échoue, rollback complet | Faible |
| `applyDown()` | `db.transaction()` : `tx.execute(down)` + `store.remove()` | ✅ Atomique | Faible |
| `acquireLock()` | `db.acquireMigrationLock()` sans retry ni timeout | ❌ Échec immédiat si lock détenu ; pas de mécanisme d'attente | Moyen |
| `run()` | Lock acquis avant boucle ; `finally { lock.release() }` | ✅ Lock libéré même en cas d'erreur | Faible |
| Vérification d'unicité | Aucune vérification que la migration n'est pas déjà appliquée avant exécution | ❌ Défense en profondeur absente | Élevé |
| `previewSQL()` | Utilise `migration.content` (SQL legacy) uniquement ; ne gère pas `up()` TypeScript | ❌ Incompatible avec les migrations TypeScript natives (Phase 03/04) | Élevé |
| `newBatchId()` | `Date.now() + Math.random()` | ⚠️ Pas de garantie d'unicité forte en cas d'appel très rapproché | Faible |

### 1.2 MigrationStore (`packages/migrations/src/store.ts` + `sql-store.ts`)

| Composant | Implémentation actuelle | Risque identifié | Gravité |
|-----------|------------------------|------------------|---------|
| `MigrationStore.save()` | Interface : `save(migration): Promise<void>` | ❌ Pas de garantie d'unicité ; laisse à l'implémentation | Moyen |
| `SqlMigrationStore.save()` | `INSERT ... ON CONFLICT(id) DO UPDATE` | ❌ **Upsert** : permet de réécrire une migration déjà appliquée, contredit l'immutabilité (R2) | Critique |
| `SqlMigrationStore.remove()` | `DELETE FROM mosaix_migrations WHERE id = ?` | ❌ Pas de vérification que la migration était bien appliquée | Moyen |
| `SqlMigrationStore.list()` | `ORDER BY applied_at ASC, id ASC` | ✅ Ordre déterministe | Faible |
| `SqlMigrationStore.get(id)` | `SELECT ... WHERE id = ?` | ✅ Correct | Faible |
| `ensureLedger()` | `CREATE TABLE IF NOT EXISTS mosaix_migrations` | ✅ Idempotent | Faible |

### 1.3 InMemoryMigrationStore (tests uniquement)

| Composant | Implémentation actuelle | Risque |
|-----------|------------------------|--------|
| `save()` | `this.entries.push({...migration})` | ❌ Pas de vérification d'unicité ; doublons possibles |
| `remove()` | `this.entries.splice(idx, 1)` | ❌ Supprime silencieusement si absent |

---

## 2. Corrections requises (Phase 05 - à implémenter après validation)

### 2.1 Store : Remplacer l'upsert par un insert strict

**Problème :** `SqlMigrationStore.save()` utilise `ON CONFLICT(id) DO UPDATE`, ce qui permet de réécrire une migration déjà appliquée. Cela contredit l'invariant d'immutabilité (R2) : une migration appliquée ne peut jamais être modifiée.

**Correction recommandée :**
```typescript
async save(migration: ExecutedMigration): Promise<void> {
  await this.ensureLedger();
  const existing = await this.get(migration.id);
  if (existing !== undefined) {
    throw new MigrationAlreadyAppliedError(migration.id);
  }
  await this.db.execute(
    `INSERT INTO mosaix_migrations (id, owner, checksum, batch_id, applied_at)
     VALUES (?, ?, ?, ?, ?)`,
    [migration.id, migration.owner, migration.checksum, migration.batchId, migration.appliedAt.toISOString()]
  );
}
```

**Critère d'acceptation :** Une tentative de `save()` sur une migration déjà appliquée lève `MigrationAlreadyAppliedError`.

### 2.2 Store : Vérification d'existence avant `remove()`

**Problème :** `remove()` supprime silencieusement même si la migration n'était pas appliquée.

**Correction recommandée :**
```typescript
async remove(id: string): Promise<void> {
  await this.ensureLedger();
  const existing = await this.get(id);
  if (existing === undefined) {
    throw new MigrationMissingError(id);
  }
  await this.db.execute(this.bind(`DELETE FROM mosaix_migrations WHERE id = ?`), [id]);
}
```

### 2.3 Runner : Vérification d'unicité avant exécution (défense en profondeur)

**Problème :** Le Planner calcule le delta, mais aucune vérification dans le Runner qu'une migration n'est pas déjà appliquée.

**Correction recommandée :** Avant d'exécuter chaque opération "up", vérifier que la migration n'est pas dans le Store.

### 2.4 Runner : Support des migrations TypeScript dans previewSQL

**Problème :** `previewSQL()` utilise `migration.content` (chaîne SQL) uniquement. Pour les migrations TypeScript natives (kind === "typescript"), il faut appeler `MigrationCompiler.compileUpAsync()`.

**Correction recommandée :** Intégrer `MigrationCompiler` dans `previewSQL()` pour les migrations TS.

### 2.5 Locks : Formaliser le comportement et documenter les limites

**PostgreSQL :** Implémenter `pg_try_advisory_lock` dans l'adapter Postgres (actuellement absent du dépôt).

**SQLite :** `BEGIN EXCLUSIVE` donne `processSafe` uniquement. Documenter clairement que la protection multi-instance n'est pas garantie sur SQLite.

### 2.6 Checksum : Exiger le checksum explicite pour les migrations TypeScript

**Déjà implémenté (Phase 04) :** Le Validator rejette `kind: "typescript"` sans checksum explicite. Vérifier que le Runner/Planner respecte cette règle.

---

## 3. Scénarios de tests à implémenter (Phase 05)

| Test | Scénario | Résultat attendu |
|------|----------|------------------|
| T05-01 | Transaction atomique : SQL échoue mid-migration | Rollback complet, Store inchangé, lock libéré |
| T05-02 | Double exécution : migration déjà appliquée | `MigrationAlreadyAppliedError` |
| T05-03 | Concurrence : deux instances, même lock | Second instance : `MigrationLockError` |
| T05-04 | Crash mid-migration : processus tué | Au redémarrage, Store cohérent, reprise par Planner |
| T05-05 | Migration modifiée après application | `MigrationChecksumError` bloquant |
| T05-06 | Migration manquante du Registry | `MigrationMissingError` bloquant |
| T05-07 | `save()` sur migration existante | `MigrationAlreadyAppliedError` |
| T05-08 | `remove()` sur migration inexistante | `MigrationMissingError` |
| T05-09 | `previewSQL()` avec migration TypeScript native | SQL compilé via `MigrationCompiler` |
| T05-10 | Lock SQLite : comportement `processSafe` uniquement | Documenté, pas de `distributed` |

---

## 4. Critères d'acceptation Phase 05 (Jalon G3)

| Critère | Description |
|---------|-------------|
| G3-01 | Une migration interrompue (crash) ne peut pas être considérée comme réussie |
| G3-02 | Une migration ne peut pas être appliquée deux fois |
| G3-03 | Une migration modifiée après application est détectée (`MigrationChecksumError`) |
| G3-04 | Une migration supprimée du Registry après application bloque (`MigrationMissingError`) |
| G3-05 | Le lock est libéré même en cas d'erreur d'exécution |
| G3-06 | Deux exécutions concurrentes ne modifient pas le schéma simultanément |
| G3-07 | Le Store est la source de vérité unique (pas de duplication avec Imperia) |
| G3-08 | Le checksum explicite est obligatoire pour les migrations TypeScript |

---

## 5. Dépendances et blocages

| Dépendance | Statut | Commentaire |
|------------|--------|-------------|
| Phase 04 (Compiler/Validator) | Implémentée, 76/76 tests | En attente de validation définitive (serveur ChatGPT indisponible) |
| Validation Phase 04 par ChatGPT | ❌ BLOQUÉ | Serveur ChatGPT MCP : erreur `UNIQUE constraint failed: conversations.title` |
| Modification du Runner | ❌ INTERDIT | Restriction Phase 05 : "Aucun changement du Runner" |
| Modification du Store | ❌ INTERDIT | Restriction Phase 05 : "Aucun changement du Store" |
| Modification des providers BACs | ❌ INTERDIT | Restriction Phase 05 |

---

## 6. Conclusion de la préparation

La Phase 05 est prête à être implémentée **dès que** :
1. Le serveur ChatGPT MCP est de nouveau disponible pour valider la Phase 04
2. Les contrats Phase 04 (Compiler/Validator) sont certifiés
3. La restriction "pas de modification du Runner/Store" est levée ou amendée

**Aucun code du Runner ou du Store n'a été modifié durant cette phase de préparation.**

---

## 7. État global de la roadmap

| Phase | Intitulé | Statut |
|-------|----------|--------|
| 01 | Audit et gel des contrats | ✅ Terminée |
| 02 | Gouvernance et ownership | ✅ Terminée (ADR-0025, ADR-0026) |
| 03 | Contrats TypeScript natifs | ✅ Terminée (55 tests) |
| 04 | Compiler et Validator | ✅ Implémentée (76 tests), validation en attente |
| 05 | Sécurisation Runtime/Store | 🔄 Préparation seulement (aucun code modifié) |
| 06 | Framework et Shell Core | ❌ Non commencé |
| 07 | Migration des 10 BACs | ❌ Non commencé |
| 08 | Isolation PostgreSQL | ❌ Non commencé |
| 09 | Cycle de vie Plugins | ❌ Non commencé |
| 10 | CLI et industrialisation | ❌ Non commencé |

---

## 8. Blocage actuel

**Serveur ChatGPT MCP indisponible** : erreur `UNIQUE constraint failed: conversations.title`. Les fonctions `chatgpt_send_prompt_conversation` et `chatgpt_conversation_create` ne sont plus accessibles (erreur `Unknown tool` ou serveur déconnecté).

**Conséquence :** Impossible de valider la Phase 04 auprès de ChatGPT, donc impossible de commencer la Phase 05 (implémentation) ni les phases 06-10.

**Action requise :** Redémarrer le serveur ChatGPT MCP ou fournir une voie de validation alternative pour la Phase 04.

---

*Rapport produit en mode autonome. Aucun fichier du Runner, du Store, ou des providers BACs n'a été modifié.*