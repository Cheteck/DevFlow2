# MosaiX / IJIDeals — BACKLOG (pilotage livraison)

- **Dernière mise à jour :** 2026-10-09 — transformation en système de pilotage (snapshot legacy : `.project/archive/active-backlog-2026-10-09-legacy.md`)
- **Principe :** ce fichier répond à « Que doit-on faire ensuite ? ». L'historique vit en `.project/archive/`, les décisions en `.project/decisions/`, l'architecture en `.project/architecture/` et `apps/*/responsibilities.md`.
- **Règle de comptage :** le nombre de tâches ouvertes se recompte depuis le registre ci-dessous, jamais depuis un paragraphe manuel.
- **Registre actif au 2026-10-11 : 5 P0 · 7 P1 · 9 P2 · vision en § Horizon 3.** Statuts réconciliés avec le code le 2026-10-09 (branche `backlog-tasks-completion-16894022842581055701`, commits `7c7fcde` + `980262b` non mergés = VERIFY, pas DONE) + audit santé 2026-10-11 (`repository-health-report.md` : +SEC-DEPS P1, +LOG-STRUCT P2). Note : l'en-tête annonçait « 10 P2 » pour 8 lignes P2 — dérive pré-existante corrigée ici par recomptage strict du registre (8 + LOG-STRUCT = 9).

## Vue d'ensemble (un coup d'œil)

| ID | Titre | Statut | Pri | Prochaine action |
|---|---|---|---|---|
| MCP-03c | Vérification Bearer cryptographique MCP | OPEN | P0 | Brancher `AuthManager` dans `principal-resolver.ts:27` (fini la simulation), test `-32001` + token révoqué |
| AUCTION-PERSIST | Persister le moteur d'enchères | OPEN | P0 | `postgres-auction-repository` + `placeBid` `SELECT FOR UPDATE` + tests concurrence + restart sans perte |
| AUTH-E2E | Preuves auth réelle sur PG | VERIFY | P0 | E2E restart (valide survit, révoquée rejetée) + guard `InMemorySecretsAdapter` (`citadelle/index.ts:160`) + e2e login/logout/session |
| DB-PGSQL-E2E | `db:setup` vert sur Postgres réelle | VERIFY | P0 | Câbler `PgClient` réel derrière `DB_CONNECTION=pgsql` + e2e ledger + seeds |
| BOUND-02 | Extraire Payments derrière `PaymentPort` | OPEN | P0 | Sortir `refund` + webhooks + `satim-payment-port` de Commerce, checkout vert via port |
| VIEW-E2E-A | Parcours Commerce/Portfolio utilisables | VERIFY | P1 | E2E `/commerce` (offres→panier→commande) + `/portfolio` (grille→fiche→search) — 10 vues existent, preuve manquante |
| VIEW-E2E-B | Parcours Spaces/Citadelle utilisables | VERIFY | P1 | E2E `/spaces` (liste→création→membres/rôles) + `/citadelle` (profil/sessions/MFA) |
| BOUND-07 | Garde-fou rôles métier vs identité | OPEN | P1 | Formaliser `citadelle.policy.evaluate`, aucun rôle métier émis par Citadelle sans ADR |
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
| SEC-DEPS | Assainir pins vitest + trier 27 GHSA | OPEN | P1 | Monter solidarity/subscription en vitest ^3, `pnpm audit` trié, gate CI |
| LOG-STRUCT | Logger structuré dans `src/` | OPEN | P2 | 32 `console.*` → `Logger` core + règle eslint anti-`console` |

Détails P0/P1 ci-dessous. P2/LATER en une ligne (pas de spec ici).

---

## P0 — Release blockers (socle + sécurité + argent)

### MCP-03c — Vérification Bearer cryptographique MCP
- **Statut :** OPEN · **Domaine :** MCP/Sec · **Dépendances :** AUTH-E2E
- **Risque :** outil IA exécuté avec Bearer forgé accepté (`principal-resolver.ts:27` simule encore).
- **Objectif :** aucun Bearer simulé ; anonyme deny-by-default conservé.
- **Critères :**
  - [ ] Anonyme → `-32001`, sans `mcp:admin`.
  - [ ] Bearer invalide/expiré/révoqué → rejet cryptographique via `AuthManager`.
  - [ ] Test dédié (anonyme + explicite + Bearer + révoqué).
- **Preuves :** `packages/mcp/src/security/principal-resolver.ts`, `server/gateway.ts`, `mcp.test.ts` — à renseigner (commit).
- **Prochaine action :** remplacer la simulation par `JwtService`/`AuthManager.validate`, ajouter le test révoqué.

### AUCTION-PERSIST — Persister le moteur d'enchères
- **Statut :** OPEN · **Domaine :** Commerce/Data · **Dépendances :** DB-PGSQL-E2E
- **Risque :** enchères volatiles (`AuctionService:72` `Map`), tables `commerce.auctions/bids` vides → perte au restart, doubles sous charge.
- **Objectif :** `placeBid` transactionnel, restart sans perte, hash chaîné vérifiable.
- **Critères :**
  - [ ] `postgres-auction-repository` branché (fini le `Map`).
  - [ ] `placeBid` : `SELECT … FOR UPDATE` + validations + insert + update + anti-sniping + `auditHash` chaîné.
  - [ ] Tests concurrence (doubles sérialisés) + restart sans perte verts.
- **Preuves :** `apps/commerce/src/domain/auction.service.ts`, `infrastructure/migrations.ts:89` — à renseigner.
- **Prochaine action :** écrire le repository + le test de concurrence avant toute UI enchères.

### AUTH-E2E — Preuves auth réelle sur PostgreSQL
- **Statut :** VERIFY (code `7c7fcde`/`980262b` sur branche, preuves E2E PG manquantes) · **Domaine :** Auth/Sec · **Dépendances :** DB-PGSQL-E2E
- **Avancement 2026-10-09 (étapes 1-2/5 revue) :** `SsrAuthContext` discriminé + navbar anonyme (`Se connecter/Créer un compte`) branchée sur `SessionResolver` dans `start.ts` ; `SessionResolver` fail-closed (revoke/expiry, fini le guest fabriqué) ; `GET /api/auth/session` vérifie expiration/révocation. Détails : `.project/reports/session-2026-10-09-auth-ssr-fix.md`. Restent étapes 3-5 (memberships espace, fuites SSR, E2E concurrence).
- **Risque :** session acceptée après révocation, secret mémoire en prod (`InMemorySecretsAdapter`, `citadelle/index.ts:160` sans guard).
- **Objectif :** aucun accès privilégié fabriqué, aucune session révoquée acceptée, aucun secret critique en mémoire en prod.
- **Critères :**
  - [ ] Session valide survit au restart ; révoquée rejetée après restart (PG réel).
  - [ ] `InMemorySecretsAdapter` interdit en démo-off/prod (guard, fail-fast).
  - [ ] E2E `POST /api/auth/login|logout` + `GET /api/auth/session` vert (cookie `__Host-mosaix_session`, CSRF, rate-limit, logout idempotent `Max-Age=0`).
  - [ ] `bootstrap/auth-composition.ts` unique, zéro import `apps/citadelle` depuis `src/` (ports `packages/ports/identity`).
- **Preuves :** `packages/auth/src/postgres-session-store-adapter.ts`, `session-resolver.ts`, `src/server/routes/auth-routes.ts`, `tests/auth-routes.test.ts` — CI/commit à renseigner.
- **Prochaine action :** exécuter l'E2E PG + le test restart/révocation, ajouter le guard secrets.

### DB-PGSQL-E2E — `db:setup` vert sur Postgres réelle
- **Statut :** VERIFY (`PgClient` + `createPgPoolClient` existent, câblage `DB_CONNECTION=pgsql` à prouver) · **Domaine :** Infra/Data
- **Risque :** dev SQLite, prod PG = dérive silencieuse.
- **Objectif :** `db:setup` (migrate + seed) vert sur PG locale, e2e ledger passant.
- **Critères :**
  - [ ] `db:setup` vert sur PG locale (placeholders `$n` OK).
  - [ ] Seeds CLI-only, `DatabaseSeeder` sans effet de bord au constructeur.
  - [ ] Boot verify fail-fast conservé.
- **Preuves :** `packages/database/src/database-manager.ts:198`, `packages/adapters/database-postgres/src/index.ts:241` — log PG à joindre.
- **Prochaine action :** lancer `db:setup` contre PG locale et joindre le log.

### BOUND-02 — Extraire Payments derrière `PaymentPort`
- **Statut :** OPEN · **Domaine :** Commerce/Archi · **Dépendances :** AUTH-E2E (webhooks signés)
- **Risque :** logique financière dupliquée, `refund`/webhooks dans Commerce.
- **Objectif :** Commerce orchestre, jamais d'état financier ; `refund` + webhooks hors Commerce.
- **Critères :**
  - [ ] `commerce_payment_intents` + `refund` + `satim-payment-port` + webhooks extraits derrière `PaymentPort`.
  - [ ] Checkout (dont COD `cod_pending→cod_delivered→succeeded`) vert via port.
  - [ ] Aucune nouvelle logique paiement hors BAC dédié (ou fiche d'écart + tâche).
- **Preuves :** `apps/commerce/src/domain/commerce-payment-intent.ts`, `satim-payment-port.ts` — à renseigner.
- **Prochaine action :** découper `refund` + webhooks en premier, sans ajouter de logique financière.

---

## P1 — Livraison fonctionnelle (parcours utilisables)

### VIEW-E2E-A/B — Parcours critiques de bout en bout
- **Statut :** VERIFY (10/10 fichiers `*-view.ts` existent : beam, booking, citadelle, commerce, imperia, portfolio, solara, solidarity, spaces, subscription — preuve E2E manquante).
- **Avancement 2026-10-09 (frontière guest) :** politique globale `src/shell/bac-access.ts` (guard SSR + navigation dérivée, commerce vitrine publique / cart+orders protégés, solara protégé, imperia admin-only, `/` anonyme → `/commerce`, `/login` fonctionnel, `/register` waiting + 501). Détails : `.project/reports/session-2026-10-09-bac-access-policy.md`. Reste : inventaire `strictViews` par BAC, memberships espace, endpoints `/api/*` par ressource (P0 avant release).
- **Avancement 2026-10-09 (guest policy + données réelles) :** politique produit guest adoptée — spaces `list/profile` publics (projection `toPublicSpace`, répertoire/gestion masqués aux guests, `new` protégé), vitrine commerce sur `commerce.offers` réel (`PostgresCommerceOfferRepository` + `listAllActive`, titres via `portfolio.translations`), commandes scoped par acheteur (`findByUserId`), états vides honnêtes partout (0 mock). Détails : `.project/reports/session-2026-10-09-guest-policy.md`. Gaps explicites (pas de faux) : page détail d'offre, recherche/tri/filtres backend, flag visibilité Space, backend panier, gating memberships, `/api/*` par ressource.
- **Critères :**
  - [ ] `/commerce` liste offres `ACTIVE`, panier + commande OK.
  - [ ] `/portfolio` grille + fiche + search (Lot PRD-0011-A).
  - [ ] `/spaces` liste + création + membres/rôles.
  - [ ] `/citadelle` (+ alias `/identity`) profil/sessions/MFA.
  - [ ] Plus aucun placeholder `/[bacid]` sur ces 4 routes.
- **Prochaine action :** écrire 4 tests E2E navigation + capture, corriger les 403/placeholders trouvés.

### PRD-0011-A — Lot A vente (découpage du « 19 pages »)
- **Statut :** OPEN · **Dépendances :** VIEW-E2E-A
- **Découpage :** A = Dashboard + Vendables All + fiche + Search (+ proposals lecture) → P1. B = Categories/Features/Variation Models → P2. C = Import/Export + proposals écriture → P2.
- **Critères :** 5 écrans Lot A verts sur PG seedée ; B/C restent en P2.
- **Prochaine action :** implémenter Lot A seul, geler B/C.

### BOUND-07 — Garde-fou rôles métier vs identité
- **Statut :** OPEN · **Domaine :** Citadelle/Archi
- **Critères :** `citadelle.policy.evaluate` formalisé ; `merchant`/`delivery_partner` émis hors Citadelle (Spaces/Commerce) ou ADR.
- **Prochaine action :** auditer `registration-wizard.service.ts`, déplacer l'attribution.

### BOUND-0304 — Billing + Notifications
- **Statut :** BLOCKED (attente cadrage release) — si catalogue sans commande/facture/email, basculer LATER. Sinon P1.
- **Prochaine action :** trancher périmètre release en une décision datée.

### TSC-RAW — Remédier `build:raw` (46 erreurs tsc)
- **Statut :** DONE 2026-10-10 · **Preuve :** `pnpm build:raw` vert (exit 0, zéro erreur).
- **Cause racine la plus coûteuse :** `as typeof portfolio` auto-référentiel (`stdio-server.ts`, `mcp-routes.ts`) figeait le type à `null` → cascade `never` (7 erreurs). Corrigé par types nommés + `createPortfolioBACClient` partagée.
- **Autres correctifs (zéro changement comportemental sauf mention) :** seed booking `title/hostId`→`providerId/serviceName` (seed cassé au runtime) ; imperia `html`→`contentHtml` (+ test `intelligence-core`, page rendue vide avant) ; inventory `HttpResponse` conforme ; solara `boot()` retourne `app` ; spaces `updatedAt` redondant supprimé ; ports `rolesAllowlist` ajouté ; PG flags `context?.` (crash si plans + sans contexte) ; root deps ports manquants + `pnpm install` ; bootstrap `authManager: AuthManager | null` + 503 honnête (**changement assumé :** login Shell toujours 401 mensonger → 503 explicite) ; adapter sessions PG réécrit sur le schéma canonique (soft-revoke) ; CLI `describeConnection` + reset via grand compteur ; intelligence 3ᵉ arg dispatch mort supprimé ; mobile-bridge ré-exports explicites ; auth-routes narrowing union + `tenantId: "default"` ; middleware `auth-guard.ts` créé ; feature-flags `instanceof` + shim nettoyé ; conformance 10→11 BAC (inventory valide).
- **Dette résiduelle (hors tsc, non régressée par ce chantier) :** voir `TEST-DEBT-RUNTIME` ci-dessous.

### TEST-DEBT-RUNTIME — Dette tests runtime pré-existante (hors tsc)
- **Statut :** OPEN · **Domaine :** Qualité/Test · **Dépendances :** aucune
- **Constat 2026-10-10 (suite complète : 832 passés) :**
  - [ ] `packages/cli/tests/cli.test.ts` (3 échecs) : 2ᵉ commande de chaque test → « database is not open ». Cause probable : `manager.close()` en `finally` ferme le cache global `closeDatabase()` (`bootstrap/app.ts:207`) réutilisé par la commande suivante du même test. Vérifié hors scope de `migration-commands.ts` (lignes modifiées non exécutées par ces tests). Corriger le cycle de vie close/cache, pas les commandes.
  - [ ] `tests/http/bac-access.http.test.ts` : harness exige `docker exec mosaix-db-1 createdb` (aucun fallback). 2026-10-10 : 14/14 verts quand le daemon répondait ; en échec (hooks) quand Docker Desktop est down dans le sandbox. Piste : supporter un PG local direct (`MOSAIX_HTTP_PG_URL`) en repli du `docker exec`, ou documenter le prérequis docker comme obligatoire (plus de faux timeout 150s : fail-fast si `docker` absent).
  - [ ] Prettier systémique : `prettier --check .` rouge sur 935 fichiers (dérive globale, voir `CONF-DETTE`). Ne pas reformater au coup par coup.
 - **Prochaine action :** traiter CLI-lifecycle d'abord (vrai bug potentiel), puis re-qualifier le boot HTTP sur DB migrée.

### SEC-DEPS — Assainir dépendances vulnérables (audit santé 2026-10-11)
- **Statut :** OPEN · **Domaine :** Sécu/Deps · **Dépendances :** aucune (dev-only)
- **Constat :** `pnpm audit` = 27 GHSA distincts dont ≥2 critical lus (`GHSA-5xrq-8626` vitest UI <3.2.6 via `apps/solidarity vitest@1.6.1` pin `^1.3.0` et `apps/subscription vitest@2.1.9` pin `^2.0.0` — racine `3.2.7` patchée ; tinypool RCE en transitif). Preuve : `.project/reports/repository-health-report.md` § Security.
- **Critères :**
  - [ ] `solidarity` + `subscription` montés en `vitest ^3`, `pnpm install`, leurs suites vertes.
  - [ ] Les 27 GHSA triés (corriger / accepter-risquer-daté / faux-positif) ; 0 critical/high restant sans décision datée.
  - [ ] Gate CI `pnpm audit --audit-level=high` (ou `pnpm audit --prod` + dev séparé).
- **Prochaine action :** monter les 2 pins vitest d'abord (fix isolé, blast radius tests seuls), puis trier le reste.

---

## Horizon 1 — Stabiliser le socle (ordre)
1. DB-PGSQL-E2E → 2. AUTH-E2E → 3. MCP-03c → 4. AUCTION-PERSIST (+ DATA-07c) → 5. BOUND-02 → 6. E2E critiques sur config cible. Gel des nouveaux chantiers sauf sécu/bloquant.

## Horizon 2 — Produit utilisable
Commerce (offre→panier→commande) → Portfolio (catalogue/fiche/search) → Spaces (espaces/membres) → Citadelle (login/profil/session) → Delivery COD si inclus → Beam/Solidarity selon release. PRD-0011 Lot A d'abord.

## Horizon 3 — Étendre et industrialiser (LATER, sans engagement release)
PRD-0011 B/C · Billing/Notifications/Media/Search/Reviews (`BOUND-03..06/08`) · Renderer split · Conformance dette ESM/Prettier · Academy/Career/Mentor · Olympia/Chronos/Patronus/Arena/Curator · multi-régions. Chaque entrée = une ligne, pas une spec.

---

## Registre DONE (résumé, détails en archive)
`TSC-RAW` (`build:raw` vert 2026-10-10, 46 erreurs tsc corrigées + 2 tests réparés) · `ROLE-P1-01/02`, `ROLE-P2..P7` (moteur + migrations, `spaces/migrations/20260922162100`) · `DATA-01/02-tables/04/05/06/09`, `DATA-08` (Zod stricts) · `CONF-01..07` (branche conformance, 655 tests, `check:integrity --strict` vert — merger) · `FEAT-01..13`, `BAC-*` Phase 25, `SEC-01` VULN-01..08 · `CIB-01`, `SHELL-01`, `PRD-0010` DB+service · `BOUND-01b/01c/01d` (isolation 9 BAC/60 tables + durcissements v1.003/v1.004, rollback prouvé) · `BOUND-01e` (durcissement booking/spaces/subscription v1.003 : hold atomique, claim SKIP LOCKED, upsert réaction, unicités NULL-safe, audit append-only, CHECKs billing, preuves par violation, aller-retour rollback prouvé). Preuves : `.project/archive/active-backlog-2026-10-09-legacy.md` §3/§7 + commits `ac99009`/`0ebe478`/`356422d`.

## Doublons et contradictions résolus (2026-10-09)
- `DATA-08` : DONE (plus cité en restant). `CIB-01` : DONE (retiré de l'ordre actif). `CONF-01..07` : résumé de clôture unique (descriptions redondantes supprimées). `MCP-01/02/04/05` : DONE (vérifié §15) ; seul reste `MCP-03c` Bearer crypto. `BOUND-01` : migrations `01b/c/d` DONE ; résiduel = `BOUND-02/07` explicites. `PRD-0011` : découpé A/B/C (fini le « 19 pages » monolithique). Compteur manuel `27 dont 15` : supprimé, remplacé par le registre ci-dessus.
