# MosaiX / IJIDeals — BACKLOG (pilotage livraison)

- **Dernière mise à jour :** 2026-10-13 — vagues V0 (sécurisation), V1 (restaurations) et V2 (vendeur E2E) ; preuves par tests/commits, voir PLAN-VAGUES.md
- **Principe :** ce fichier répond à « Que doit-on faire ensuite ? ». L'historique vit en `.project/archive/`, les décisions en `.project/decisions/`, l'architecture en `.project/architecture/` et `apps/*/responsibilities.md`.
- **Règle de comptage :** le nombre de tâches ouvertes se recompte depuis le registre ci-dessous, jamais depuis un paragraphe manuel.

## Vue d'ensemble (un coup d'œil)

| ID | Titre | Statut | Pri | Prochaine action |
|---|---|---|---|---|
| MCP-03c | Vérification Bearer cryptographique MCP | DONE | P0 | Prouvé V3 : deny anonyme `-32001`, JWT valide accepté, faux/expiré rejetés (11/11 `mcp+permission-alignment`) |
| AUCTION-PERSIST | Persister le moteur d'enchères | DONE | P0 | Validé par `PostgresAuctionRepository` + `SELECT FOR UPDATE` + tests de concurrence |
| AUTH-E2E | Preuves auth réelle sur PG | VERIFY | P0 | E2E restart (valide survit, révoquée rejetée) + guard `InMemorySecretsAdapter` (`citadelle/index.ts:160`) + e2e login/logout/session |
| DB-PGSQL-E2E | `db:setup` vert sur Postgres réelle | VERIFY | P0 | Câbler `PgClient` réel derrière `DB_CONNECTION=pgsql` + e2e ledger + seeds |
| BOUND-02 | Extraire Payments derrière `PaymentPort` | DONE | P0 | `UnifiedPaymentPort` formalisé ; webhook HMAC-SHA256 fail-closed imposé avant CONFIRM (V3.1, 21/21 commerce). Reste : alignement canonisation SATIM avant prod réelle |
| VIEW-E2E-A | Parcours Commerce/Portfolio utilisables | VERIFY | P1 | E2E `/commerce` (offres→panier→commande) + `/portfolio` (grille→fiche→search) — 10 vues existent, preuve manquante |
| VIEW-E2E-B | Parcours Spaces/Citadelle utilisables | VERIFY | P1 | E2E `/spaces` (liste→création→membres/rôles) + `/citadelle` (profil/sessions/MFA) |
| BOUND-07 | Garde-fou rôles métier vs identité | DONE | P1 | `CitadellePolicyEvaluator` formalisé dans `citadelle-policy.ts` et validé par tests unitaires |
| PRD-0011-A | Lot A vente (grille/fiche/search) | OPEN | P1 | Implémenter 5 écrans vente, découper B/C en P2 |
| BOUND-0304 | Billing + Notifications (si release) | BLOCKED | P1 | Trancher périmètre release ; sinon basculer LATER |
| VIEW-ADMIN | Imperia 403 + Subscription hors nav | VERIFY | P2 | Test `403` non-admin + `subscription` absent sidebar, accessible via Imperia |
| PRD-0011-BC | Lots B/C admin + import/export | OPEN | P2 | Après Lot A |
| BOUND-050608 | Media/Search/Reviews | OPEN | P2 | Geler duplication, une capability `discovery.search`, aucun fichier hors Assets |
| HYGIENE-DB | Ownership BAC + FK + seeds CLI | OPEN | P2 | `DB-BAC-OWNERSHIP` + `DB-FK-HARDEN` (`v1.002`) + `DB-BOOKING-SEED` + `DB-SHELL-REGISTRY-PKG` |
| HYGIENE-SHELL | Renderer split + palette wiring | OPEN | P2 | Snapshots renderer d'abord, puis split `>400L` ; `⌘K` via `setOverlayOpen()` |
| INT-MCP-01 | File de revue Intelligence persistée | OPEN | P2 | Outbox `DatabasePort` pour `HumanReviewQueue`, calibration confiance (fini `0.98` dur) |
| INT-MCP-02 | `tools/list` depuis `CapabilityRegistry` | OPEN | P2 | Ajout capability = nouvel outil sans code MCP |
| CONF-DETTE | ESM NodeNext + Prettier global | OPEN | P2 | Planifier hors release (`~500` imports, 758 fichiers) |
| DATA-07c | Triggers compteurs + concurrence | VERIFY | P0→P1* | *Rétrogradé P1 si `980262b` prouvé E2E PG ; sinon reste P0. Tests `SELECT FOR UPDATE` + triggers + job purge `holdExpiresAt` |
| SEC-DEPS | Assainir pins vitest + trier 27 GHSA | DONE | P1 | Pins Vitest ^3.0.0 mis à jour dans `solidarity` et `subscription` |
| LOG-STRUCT | Logger structuré dans `src/` | DONE | P2 | `ConsoleLogger` intégré dans `src/start.ts` |
| PORT-UI-00 | Portfolio admin : stopper les données fabriquées | DONE | P0 | Faux produits et métriques fictifs purgés, raccordé au service réel |
| PORT-UI-01 | Portfolio admin : catalogue + recherche réels | DONE | P1 | Raccordé à `PortfolioService.search()` |
| PORT-UI-02 | Portfolio admin : page fiche détail | DONE | P1 | Rendu fiche détaillée PIM (`view=detail&ref=...`) implémenté |
| PORT-UI-03 | Wizard produit (admin direct + proposition vendeur) | OPEN | P2 | Wizard branché (création admin + mode proposition → `ProposalService` ; saisie vendeur côté Space, emplacement à trancher) |
| PORT-UI-04 | Portfolio admin : file de revue des propositions vendeurs | OPEN | P2 | Approuver/rejeter via `ProposalService` ; vérifier offre créée (SELL-FLOW-01), refus = rien publié, events cohérents |
| PORT-UI-05 | Portfolio UI : import/export branchés | OPEN | P2 | Dropzone + rapports vers parser CSV réel (cf. PRD-0011-BC) |
| PORT-UI-06 | Portfolio UI : i18n FR/EN/AR + SEO + a11y | OPEN | P2 | Sélecteur langue, meta par fiche, labels/aria |
| PORT-UI-07 | Portfolio UI : tests sur données réelles + ménage | OPEN | P2 | Réécrire asserts sur mocks, supprimer manifeste slots mort, fixer vocabulaire EAV |
| SHELL-SEC-01 | Shell : vérifier les frontières de sécurité | OPEN | P0 | Partiel V3 : suites frontières+invariants vertes 11/11. Reste : audit handlers `/api/*`, multi-tenant, chemins SSR ; corriger toute divergence exploitable |
| SHELL-PERM-01 | Shell : source canonique des permissions | DONE | P1 | Catalogue `CANONICAL_BAC_IDS` et helpers de validation ajoutés |
| SHELL-UI-01 | Shell : réparer le validateur UI (faux-vert) | DONE | P1 | Valideur de contrats UI réparé et exécuté avec succès |
| SHELL-INV-01 | Shell : suite invariants production | DONE | P1 | Suite de tests d'invariants de production ajoutée dans `tests/shell-production-invariants.test.ts` |
| SHELL-BAC-01 | Shell : statut explicite par BAC + wiring ciblé | OPEN | P2 | Matrice persistance/autorisation/cycle de vie/API/UX/tests par BAC |
| SHELL-TRUTH-01 | Shell : supprimer les comportements trompeurs | OPEN | P2 | Compteurs fictifs, likes no-op, home-page morte : retirer ou expliciter |
| SHELL-RENDER-01 | Shell : découper `renderer.ts` sans changer le comportement | OPEN | P2 | Caractérisation d'abord, CTA déclaratifs, suppression fallback `allowedBacs` (complète HYGIENE-SHELL) |
| SELL-FLOW-01 | Approbation vendeur atomique (vendable + offre + events) | DONE | P1 | Saga `ProposalService.approve()` avec `OfferProvisioningPort` ; delta restauré V1.2 (`approvedTerms`/`auditTrail`/`idempotence`, replay sans doublon, 15/15 `proposal+portfolio`) |
| SELL-FLOW-02 | Parcours vendeur dans Space (« mettre en vente ») | DONE | P2 | E2E formulaire `view=sell`→POST `/api/spaces/:spaceId/proposals`→Draft (route+wiring V1.3 5/5, câblage SSR+redirect V2 8/8 route, 7/7 vue) |
| PRICE-01 | Contrat de prix et historique | DONE | P1 | Prix de base offre + journal append-only `priceHistory` + `resolveEffectivePrice()` (ADR-0021) |
| PROMO-01 | Moteur de promotions | DONE | P2 | Implémenté via `PromotionEngine` dans `promotion-engine.ts` |
| COUPON-01 | Codes et consommation des coupons | DONE | P2 | Implémenté via `CouponService` dans `coupon-service.ts` |
| PRICE-02 | Remises figées en commande + traçabilité | DONE | P2 | Freeze commercial line item snapshot dans `OrderService.createOrder()` |
| AUTH-05 | Projection identité session→profil (IdentityProfilePort) | OPEN | P1 | `context.user.id` d'exécution = identité de session (commandes scoped, espaces) — cf. revue commerce-view |
| COMMERCE-CART-01 | Backend panier réel (création/mutation/validation prix+stock) | OPEN | P2 | CTA actuel = badge honnête « bientôt disponible » ; checkout revalide prix+stock (BOUND-02) |
| VUES-AUTHFLAG-01 | Brancher `isAuthenticated` dans les vues restantes (spaces, etc.) | OPEN | P2 | Même P1 rôles≠auth que commerce-view ; contrat déjà requis dans `BacExecutionContext` |
| PLG-01 | Unification contrat PluginManifest & schéma Zod | OPEN | P1 | Aligner PluginManifest entre @mosaix/contracts, schemas et plugin-engine (GAP-PLG-01) |
| PLG-02 | Bootstrapping PluginEngine dans le Shell | OPEN | P1 | Ajouter provider plugin-engine dans bootstrap/providers.ts (GAP-PLG-05) |
| PLG-03 | Manifestes mosaix.json pour plugins/* | OPEN | P1 | Créer mosaix.json pour les 6 plugins de plugins/* (GAP-PLG-03) |
| PLG-04 | Migration Solara Moderator vers HookEngine | OPEN | P1 | Remplacer import statique par hook solara.post.beforeCreate (GAP-PLG-03) |
| PLG-05 | Imperia PluginManager raccordé à PluginEngine | OPEN | P2 | Déserver catalogue simulé vers PluginEngine réel (GAP-PLG-04) |
| PLG-06 | Hooks canoniques Checkout Commerce | OPEN | P2 | Déclencher commerce.checkout.calculateDiscount au checkout (GAP-PLG-05) |
| PLG-07 | Diagnostic CLI & Guide développeur plugins | OPEN | P3 | Rédiger docs/plugins-guide.md et valider CLI plugin (GAP-PLG-01..05) |
| MIG-IMMUT-01 | Garde CI : migrations appliquées immuables (snapshot checksums) | OPEN | P1 | Test snapshot des checksums du registre shell : toute édition en place d'une migration déjà appliquée (cf. incident `commerce.shop.v1.001` 2026-10-13) échoue en CI au lieu de casser le boot dev/prod |
| CLI-MIGRATE-01 | CLI `migrate`/`rollback` sqlite : `database is not open` + seed vide | DONE | P1 | Corrigé 2026-10-14 : `closeCliDatabase()` (vide le cache bootstrap) dans les 8 `finally` CLI ; 19/19 `cli.test.ts` verts (repro + cycle migrate→seed→rollback prouvés) |
| CLI-SEED-01 | Refactor seeder : SQL brut → InsertQueryBuilder typé (@mosaix/ports-database) | OPEN | P2 | Remplacer les 8 blocs INSERT SQL de `database-seeder.ts` par `InsertQueryBuilder` + `transaction()` pour l'atomicité |
| OBS-METRICS-01 | Exporteur `/metrics` Prometheus absent (prétention fausse) | DONE | P2 | Livré 2026-10-14 : `GET /metrics` exposition texte (3 jauges process, sans couplage DB), testé (4 tests) + vérifié live 200 |
| TEST-RED-01 | 5 tests rouges prouvés pré-existants (différentiel stash 2026-10-13) | DONE | P1 | Tous corrigés 2026-10-14 : CLI×3 (fermeture), FEAT-04 (await), plugin-e2e (devDep + contrat errors[]), http (clone hermétique) + durcissement timeout auction-wiring (flaky 5 s sous charge). Suite : voir §suivi |

---

## Tâche détaillée — CLI-SEED-01 : Refactor seeder SQL brut → InsertQueryBuilder typé

### 1. Contexte et état actuel

**Fichier concerné :** `src/shell/seeders/database-seeder.ts` (198 lignes)

**Problème :** Le seeder exécute 8 blocs d'insertion de données de démonstration via du **SQL brut** (`INSERT INTO ... VALUES ...`) avec adaptation manuelle des placeholders `?` → `$1, $2` via la fonction `bind()` :

```ts
function bind(db: DatabasePort, sql: string): string {
  if (db.capabilities.dialect !== "postgres") return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
```

Chaque bloc est précédé d'un guard `tableCount(db, table) === 0` pour l'idempotence. Les tables concernées : `shell_feed`, `commerce_products`, `portfolio_items`, `spaces`, `beam_channels`, `beam_messages`, `booking_slots`, `imperia_proposals`, `solidarity_campaigns`.

**Problèmes identifiés :**

| ID | Problème | Impact |
|----|----------|--------|
| S1 | **Incohérence architecturale** : le système de migrations utilise `SchemaBuilder` + `Grammar` (typé, dialect-agnostique) pour le DDL, mais le seeder utilise du SQL brut pour le DML. Deux façons d'interagir avec la base coexistent. | Duplication de logique, surcharge cognitive, risque de divergence entre dialectes. |
| S2 | **Pas de typage des données** : les enregistrements sont passés comme chaînes brutes dans le SQL. Aucune vérification de type au moment de l'écriture. | Risque d'erreur silencieuse (type mismatched, NULL sur NOT NULL) détecté seulement à l'exécution sur la vraie base. |
| S3 | **Pas de transaction** : chaque bloc d'insertion s'exécute indépendamment. Si le seeder échoue au bloc 5 (ex: `imperia_proposals`), les blocs 1-4 sont déjà persistes. | État partiel de la base, impossible de relancer proprement sans nettoyage manuel. |
| S4 | **Adaptation manuelle des placeholders** : `bind()` remplace `?` par `$N` avec un compteur global. Fragile si des `?` apparaissent dans des chaînes de caractères SQL. | Bug potentiel si une valeur contient un `?`. |
| S5 | **Pas de test unitaire** : aucune couverture de test sur le seeder. | Régressions non détectées. |

### 2. Solution cible

**Objectif :** Remplacer les 8 blocs SQL brut par des appels typés via `InsertQueryBuilder` (déjà disponible dans `@mosaix/ports-database`), enveloppés dans une `transaction()` pour l'atomicité, et garder les guards d'idempotence existants.

**API disponible (déjà implémentée et exportée) :**

```ts
import { createQueryBuilder, type DatabasePort } from "@mosaix/ports-database";

const qb = createQueryBuilder();

// INSERT multiple lignes
await qb.insert()
  .into("shell_feed")
  .values([{ id, type, author, ... }, { ... }])
  .execute(db);

// Transaction
await db.transaction(async (tx) => {
  await qb.insert().into("shell_feed").values([...]).execute(tx);
  await qb.insert().into("commerce_products").values([...]).execute(tx);
});
```

`InsertQueryBuilder.toSql(dialect)` génère automatiquement les bons placeholders (`$1` pour Postgres, `?` pour SQLite) via `formatPlaceholder()`.

### 3. Étapes d'implémentation

#### Étape 1 — Audit du seeder actuel (30 min)
- Lire `src/shell/seeders/database-seeder.ts` en entier
- Inventorier chaque bloc INSERT : table, colonnes, nombre de lignes, types de données
- Vérifier qu'aucune logique métier cachée n'est dans le SQL (ex: calculs, sous-requêtes)

#### Étape 2 — Créer le nouveau seeder typé (2h)
- Remplacer chaque bloc `INSERT INTO ... VALUES` par `qb.insert().into(table).values([...]).execute(db)`
- Utiliser `createQueryBuilder()` depuis `@mosaix/ports-database`
- Conserver les guards `tableCount(db, table) === 0` pour l'idempotence
- Conserver les commentaires métier existants (ils documentent l'intention)

#### Étape 3 — Envelopper dans une transaction (30 min)
- Envelopper l'ensemble des insertions dans `db.transaction(async (tx) => { ... })`
- Si un bloc échoue, tout est rollback (atomicité du seed)

#### Étape 4 — Tests (1h)
- Créer `src/shell/seeders/database-seeder.test.ts`
- Tester l'insertion sur un `DatabasePort` mock (SQLite en mémoire ou double)
- Vérifier l'idempotence (deuxième appel ne duplique pas)
- Vérifier l'atomicité (si un insert échoue, rien n'est persiste)

#### Étape 5 — Vérification compilation + tests existants (30 min)
- `npx tsc --noEmit` : 0 erreur
- `vitest run` : pas de régression sur les tests existants

### 4. Critères de sortie (Définition de Done)

- [ ] `src/shell/seeders/database-seeder.ts` ne contient plus de SQL brut `INSERT` (le moteur n'accepte plus aucun SQL brut : l'echappement `rawSql` a ete retire de `@mosaix/migrations`)
- [ ] Chaque insertion utilise `InsertQueryBuilder` depuis `@mosaix/ports-database`
- [ ] Toutes les insertions sont enveloppées dans `db.transaction()`
- [ ] Les guards d'idempotence (`tableCount === 0`) sont préservés
- [ ] `npx tsc --noEmit` : 0 erreur dans le projet
- [ ] `vitest run` : tous les tests passent, y compris les nouveaux tests du seeder
- [ ] Le seeder fonctionne sur SQLite et Postgres (dialect géré automatiquement par `InsertQueryBuilder.toSql()`)

### 5. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| `InsertQueryBuilder` ne gère pas un cas particulier du seeder actuel (ex: valeur NULL, type spécial) | Moyenne | Moyen | Tester chaque bloc individuellement ; garder un fallback SQL brut documenté si nécessaire |
| Récupération des IDs générés (SERIAL/UUID) non gérée | Faible | Moyen | Vérifier que `InsertQueryBuilder.execute()` retourne le count ; si besoin d'IDs, utiliser `RETURNING` ou séparer les inserts |
| Régression sur le comportement idempotent existant | Faible | Élevé | Tests dédiés sur l'idempotence avant/après refactor |

### 6. Dépendances

- **Aucune nouvelle dépendance** : `@mosaix/ports-database` est déjà une dépendance interne du monorepo, et `createQueryBuilder` + `InsertQueryBuilder` sont déjà exportés depuis son `index.ts`
- Le seeder importe déjà `type { DatabasePort } from "@mosaix/ports-database"` — il suffit d'ajouter `createQueryBuilder`

### 7. Preuve attendue

```
git diff src/shell/seeders/database-seeder.ts
# → plus de "INSERT INTO" en SQL brut, seulement qb.insert().into().values().execute()

npx tsc --noEmit -p tsconfig.json
# → 0 erreur

vitest run src/shell/seeders/database-seeder.test.ts
# → tous les tests verts

pnpm mosaix db:setup (ou migrate + seed)
# → seed appliqué sans erreur sur SQLite et Postgres
```

### 8. Estimation

- **Temps total estimé : 4h**
- **Priorité : P2** (hygiène architecturale, cohérence du système de migration)
- **Statut : OPEN** — non commencé
