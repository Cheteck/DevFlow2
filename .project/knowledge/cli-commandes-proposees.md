# Commandes CLI proposées — registre détaillé

> Origine : suggestions post-`check:slop` (PRD-0012). Ce document enregistre
> le périmètre précis de chaque commande proposée pour éviter les doublons
> avec l'existant (`pnpm mosaix list` : lifecycle, `registry/manifest/capability/event/permission`
> inspect+validate, `migrate:*`, `check:*`, `doctor`, `make:*`, `explain`, `trace:*`).
> Statut global : **propositions, rien d'implémenté** (sauf `check:slop`, voir PRD-0012).

## P0 — douleurs vécues sur ce dépôt

### 1. `schema:drift` — Dérive schéma Desired vs ledger vs live
- **Problème** : `uniq_carts_user` en index mais pas en contrainte, migrations appliquées dont le contenu ne matchait plus, tables fantômes. Rien ne détecte la dérive entre (a) migrations désirées, (b) ledger `mosaix_migrations`, (c) schéma live PG (`pg_constraint`, `pg_indexes`, `information_schema`).
- **Commande** : `pnpm mosaix schema:drift [--json]` — compare les trois sources, rapporte `missing-applied` / `drifted-definition` / `orphan-table`, exit non nul si dérive. Lecture seule (jamais de DDL).
- **Non-duplication** : `migrate:status` compare désiré vs ledger uniquement ; `schema:drift` ajoute la base live.
- **Acceptation** : vert sur dev après les chantiers BOUND-01b/c/d ; détecte une dérive injectée en test.

### 2. `mcp:audit` — Cohérence outils MCP ↔ capabilities BAC
- **Problème** : permissions fantômes (`portfolio:vendables:read`), handlers factices (`Math.random`, `availableQuantity: 42`), outils non branchés. Trouvé à la main, à automatiser.
- **Commande** : `pnpm mosaix mcp:audit [--json]` — chaque `requiredPermission` doit exister dans un MANIFEST ; chaque handler marqué stub (pattern `Math.random`, données en dur) est signalé ; chaque capability BAC sans outil (et inversement) est listée.
- **Non-duplication** : `registry:capabilities` liste, `mcp:audit` vérifie la jointure.
- **Acceptation** : zéro fantôme après MCP-02 (test `permission-alignment` existant à réutiliser comme oracle).

### 3. `routes:audit` — Cartographie et hygiène des routes HTTP
- **Problème** : 3 routes sans `Guard`, préfixes incohérents (`/vendables/publish` vs `/portfolio/*`), routes codées jamais branchées au dispatcher.
- **Commande** : `pnpm mosaix routes:audit [--json]` — inventaire shell + BACs (méthode, path, garde `Guard.authorize` présente/absente, branchée/non branchée), conflits de paths, mutations sans auth en erreur.
- **Non-duplication** : aucune commande routes n'existe.
- **Acceptation** : portfolio 100 % gardé et préfixé (état post-Lot D) ; détecte une route non gardée injectée en test.

## P1 — angles morts structurels

### 4. `audit:dead-code` — Code et tables morts
- **Problème** : 13 tables relationnelles jamais lues/écrites, search à facettes jamais instancié, double implémentation CSV, events déclarés jamais émis.
- **Commande** : `pnpm mosaix audit:dead-code [--json]` — tables sans lecteur (croiser migrations × grep SQL), capabilities/events déclarés vs appelés/émis, exports sans importeurs.
- **Non-duplication** : `check:slop` est textuel (patterns) ; `audit:dead-code` est structurel (graphe d'usage). Complémentaires.
- **Acceptation** : retrouve les cas portfolio connus listés ci-dessus.

### 5. `docs:sync-check` — Dérive docs ↔ code
- **Problème** : capabilities documentées vs enregistrées, tables listées dans `docs/bacs` vs base live, statuts PRD vs réel — corrigé 4 fois à la main.
- **Commande** : `pnpm mosaix docs:sync-check [--json]` — extrait les affirmations vérifiables des docs (`docs/bacs/*.md`, `responsibilities.md`, PRD) et les confronte au code/BD.
- **Non-duplication** : scope `docs` de `check:slop` cherche TODO/obsolescence textuelle, pas la conformité structurelle.
- **Acceptation** : vert après les alignements BOUND-01b/c/d.

### 6. `coverage:contracts` — Couverture par contrat, pas par ligne
- **Problème** : publish, approve atomique, hold concurrent non testés alors que le % de lignes paraît sain.
- **Commande** : `pnpm mosaix coverage:contracts [--json]` — chaque capability/route/workflow critique doit avoir ≥ 1 test la nommant ; rapporte les trous.
- **Non-duplication** : `vitest --coverage` mesure des lignes, pas des contrats.
- **Acceptation** : liste les trous connus (publish, approve, hold) avant implémentation.

## P2 — utiles, moins urgents

### 7. `deps:check` — Graphe workspace et frontières
- **Problème** : 2 crashs runtime (`@mosaix/auth`, `@mosaix/intelligence` manquants), imports `packages→apps` interdits non vérifiés.
- **Commande** : `pnpm mosaix deps:check [--json]` — dépendances déclarées vs importées, couches (`eslintBoundaries`) respectées, cycles.
- **Non-duplication** : la config `eslintBoundaries` existe mais rien ne l'exploite en CLI.

### 8. `contracts:diff` — Breaking changes entre branches
- **Problème** : `capability:validate` est instantané, pas différentiel — une PR cassant un contrat passe.
- **Commande** : `pnpm mosaix contracts:diff --base=<ref> [--json]` — capabilities/events/ports ajoutés/retirés/modifiés (signatures), verdict breaking/non-breaking pour la CI PR.
- **Non-duplication** : complète `capability:validate` au lieu de la remplacer.

## Ordre suggéré
`schema:drift` → `mcp:audit` → `audit:dead-code` → `routes:audit` → `docs:sync-check` → `coverage:contracts` → `deps:check` → `contracts:diff`. Chacune : mini-PRD ou section ci-dessus promue en spec avant implémentation.
