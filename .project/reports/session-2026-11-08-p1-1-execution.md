# Rapport de session — 2026-11-08

## Objectif
Poursuivre l'exécution du plan P1.1 (tests E2E PostgreSQL d'isolation) et corriger l'infra multi-tenant Portfolio (enregistrement + application de la migration tenant_id).

## Travaux réalisés

### 1. Migration multi-tenant Portfolio — ENREGISTRÉE + APPLIQUÉE
**Fichier :** `apps/portfolio/src/infrastructure/migrations/20261108120000_add_tenant_id_to_portfolio.ts`
- Corrigé l'id canonique : `portfolio.catalog.v1.008_tenant_id` (v1.004 déjà pris par `harden_data_integrity`)
- Corrigé `DROP INDEX` au lieu de `DROP CONSTRAINT` pour l'index bare `uniq_vendable_reference` (créé par l'ORM via `table.unique()`, pas une contrainte nommée)
- Supprimé la contrainte redondante `UNIQUE (id)` (id est déjà PK)
- Corrigé le `down` pour utiliser `CREATE UNIQUE INDEX` (symétrique avec l'up)

**Registre :** `src/shell/bac-migrations.ts`
- Ajout de l'import, du canonical ID `portfolioTenantId`, et du `StaticMigrationProvider` dans `createBacMigrationProviders()`

**Application sur `mosaix_dev` (DB de dev, 37 vendables, 0 proposals) :**
- `tenant_id` ajouté à `portfolio.vendables` et `portfolio.proposals`
- 37 vendables backfillés (`tenant_id = id`)
- Index `idx_vendables_tenant` et `idx_proposals_tenant` créés
- Contrainte `uniq_vendable_tenant_reference` (composite) ajoutée
- Index bare `uniq_vendable_reference` supprimé (isolait globalement `reference`, contournant le multi-tenant)
- Contrainte redondante `uniq_vendable_id` supprimée (id est déjà PK)

**Ledger :** Entrée `portfolio.catalog.v1.008_tenant_id` insérée dans `mosaix_migrations` avec checksum FNV-1a `f1ffd4ef8f86c1f0`

### 2. Rapport P0 corrigé
**Fichier :** `.project/reports/P0-MOSAIX-IJIDEALS-ETAT-DES-LIEUX.md`
- Statut Portfolio multi-tenant : `✅ LIVRÉ` → `⚠️ PARTIEL`
- Justification : migration jamais appliquée en production, 0 test PostgreSQL multi-tenant, backfill sémantiquement discutable (`tenant_id = id`)

### 3. Infrastructure de test E2E réécrite
**Fichier :** `src/test/e2e-test-helpers.ts`
- Schéma réel vérifié sur `mosaix_dev` (2026-11-08) :
  - `spaces.spaces` (ownerId, tenantId camelCase)
  - `spaces.space_members` (spaceId, userId, roleId NOT NULL via FK)
  - `commerce.offers` (vendableId, sellerId, priceInCents, currency… — PAS de space_id)
  - `portfolio.vendables` (tenant_id text NOT NULL)
  - `portfolio.proposals` (tenant_id text NOT NULL)
  - `public.identities` (pas de `citadelle.users`, pas de `portfolio.tenants`)
- Tables drop+recreate pour état propre à chaque test
- `dropTestDatabase` null-safe (db peut être undefined si createTestDatabase échoue)

### 4. T1 — Isolation inter-Spaces (3/3 verts)
**Fichier :** `apps/spaces/src/space-isolation.test.ts`
- user_1 ne voit que space_1 dans space_members (isolation stricte)
- user_2 ne voit que space_2 dans space_members
- Requête sans filtre userId = danger (tous les membres visibles)

### 5. T2 — Isolation multi-tenant Portfolio (3/3 verts)
**Fichier :** `apps/portfolio/src/portfolio-multi-tenant.test.ts`
- tenant_A ne voit que ses vendables (isolation par tenant_id)
- tenant_B ne voit que ses vendables
- Isolation des proposals par tenant_id

## Décisions prises (validées par ChatGPT)
- GO : enregistrement et application de la migration tenant_id (4 preuves fournies : diff, contenu, application DB vierge bloquée par bug pré-existant, application DB avec données OK)
- GO : réécriture des helpers et T1 avec schéma réel
- GO : création de T2
- Réserve ChatGPT : backfill `tenant_id = id` sémantiquement discutable — multi-tenant non considéré comme livré avant clarification
- Réserve ChatGPT : bug `booking.slots` (collision de ressource `table:booking.slots` entre v1.002 et v1.003) à traiter séparément

## Tests exécutés (résultats)
| Test | Résultat | Preuve |
|------|----------|--------|
| T1 — space-isolation | 3/3 ✅ | `pnpm test apps/spaces/src/space-isolation.test.ts` |
| T2 — portfolio-multi-tenant | 3/3 ✅ | `pnpm test apps/portfolio/src/portfolio-multi-tenant.test.ts` |
| tenant-intrusion (InMemory) | 11/11 ✅ | Test pré-existant, non régressé |

**Note :** T1 et T2 ne peuvent pas s'exécuter dans le même processus vitest (partagent `mosaix_test`, conflit sur `CREATE SCHEMA`). À exécuter séparément ou avec `maxWorkers: 1`.

## État Git
- Branche : `audit-technique-mosaix-8397822254578305712`
- Commit avant : `bdc8b0d`
- Modifications non commitées : migration tenant_id, bac-migrations.ts, T1, T2, e2e-test-helpers.ts, P0 report, plan d'exécution
- DB `mosaix_dev` : migration appliquée (tenant_id présent sur vendables + proposals)
- DB `mosaix_test` : créée, utilisée pour les tests E2E

## Prochaines actions
1. Corriger le bug `booking.slots` (collision de migration) pour permettre `mosaix migrate` sur DB vierge
2. Clarifier la sémantique du backfill `tenant_id` sur les 37 vendables existants
3. P1.2 : implémenter le middleware API guard + 7 tests négatifs
4. P1.3 : définir le modèle Order/Payment persistence (bloqué)