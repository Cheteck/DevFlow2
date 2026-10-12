# MosaiX / IJIDeals — BACKLOG (pilotage livraison)

- **Dernière mise à jour :** 2026-10-09 — transformation en système de pilotage (snapshot legacy : `.project/archive/active-backlog-2026-10-09-legacy.md`)
- **Principe :** ce fichier répond à « Que doit-on faire ensuite ? ». L'historique vit en `.project/archive/`, les décisions en `.project/decisions/`, l'architecture en `.project/architecture/` et `apps/*/responsibilities.md`.
- **Règle de comptage :** le nombre de tâches ouvertes se recompte depuis le registre ci-dessous, jamais depuis un paragraphe manuel.
- **Registre actif au 2026-10-12 : 8 P0 · 13 P1 · 21 P2 · vision en § Horizon 3.** Statuts réconciliés avec le code le 2026-10-09 (branche `backlog-tasks-completion-16894022842581055701`, commits `7c7fcde` + `980262b` non mergés = VERIFY, pas DONE) + audit santé 2026-10-11 (`repository-health-report.md` : +SEC-DEPS P1, +LOG-STRUCT P2) + audit frontend portfolio 2026-10-12 (+PORT-UI-00 P0, +PORT-UI-01/02 P1, +PORT-UI-03..07 P2) + audit shell frontend 2026-10-12 (+SHELL-SEC-01 P0, +SHELL-PERM-01/SHELL-UI-01/SHELL-INV-01 P1, +SHELL-BAC-01/SHELL-TRUTH-01/SHELL-RENDER-01 P2) + parcours vendeur 2026-10-12 (+SELL-FLOW-01 P1, +SELL-FLOW-02 P2, ADR-0020) + prix/promos 2026-10-12 (+PRICE-01 P1, +PROMO-01/COUPON-01/PRICE-02 P2, ADR-0021). Note : l'en-tête annonçait « 10 P2 » pour 8 lignes P2 — dérive pré-existante corrigée ici par recomptage strict du registre (8 + LOG-STRUCT = 9).

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
| PORT-UI-00 | Portfolio admin : stopper les données fabriquées | OPEN | P0 | Brancher vues admin sur repository OU bandeau démo + purger mocks + vocabulaire domaine |
| PORT-UI-01 | Portfolio admin : catalogue + recherche réels | OPEN | P1 | Grille admin (tous statuts, flags qualité) sur `search()`, facettes, pagination |
| PORT-UI-02 | Portfolio admin : page fiche détail | OPEN | P1 | Specs, variantes, media, options ADR-0019, qualité réelle, SEO + actions workflow |
| PORT-UI-03 | Wizard produit (admin direct + proposition vendeur) | OPEN | P2 | Wizard branché (création admin + mode proposition → `ProposalService` ; saisie vendeur côté Space, emplacement à trancher) |
| PORT-UI-04 | Portfolio admin : file de revue des propositions vendeurs | OPEN | P2 | Approuver/rejeter via `ProposalService` ; vérifier offre créée (SELL-FLOW-01), refus = rien publié, events cohérents |
| PORT-UI-05 | Portfolio UI : import/export branchés | OPEN | P2 | Dropzone + rapports vers parser CSV réel (cf. PRD-0011-BC) |
| PORT-UI-06 | Portfolio UI : i18n FR/EN/AR + SEO + a11y | OPEN | P2 | Sélecteur langue, meta par fiche, labels/aria |
| PORT-UI-07 | Portfolio UI : tests sur données réelles + ménage | OPEN | P2 | Réécrire asserts sur mocks, supprimer manifeste slots mort, fixer vocabulaire EAV |
| SHELL-SEC-01 | Shell : vérifier les frontières de sécurité | OPEN | P0 | Permissions effectives + handlers `/api/*` + multi-tenant + chemins SSR ; corriger toute divergence exploitable |
| SHELL-PERM-01 | Shell : source canonique des permissions | OPEN | P1 | Modèle canonique `BacId`/`Permission` typé + tests inconnues/alias/incohérences |
| SHELL-UI-01 | Shell : réparer le validateur UI (faux-vert) | OPEN | P1 | Échoue sur contrat manquant/invalide + fixtures ; sinon retrait CI explicite |
| SHELL-INV-01 | Shell : suite invariants production | OPEN | P1 | 7 invariants (anonyme/auth/tenant/démo/likes…) sur identités représentatives |
| SHELL-BAC-01 | Shell : statut explicite par BAC + wiring ciblé | OPEN | P2 | Matrice persistance/autorisation/cycle de vie/API/UX/tests par BAC |
| SHELL-TRUTH-01 | Shell : supprimer les comportements trompeurs | OPEN | P2 | Compteurs fictifs, likes no-op, home-page morte : retirer ou expliciter |
| SHELL-RENDER-01 | Shell : découper `renderer.ts` sans changer le comportement | OPEN | P2 | Caractérisation d'abord, CTA déclaratifs, suppression fallback `allowedBacs` (complète HYGIENE-SHELL) |
| SELL-FLOW-01 | Approbation vendeur atomique (vendable + offre + events) | OPEN | P1 | `commercialTerms`/`approvedTerms`/`offerId`, port obligatoire, saga idempotente, `commerce.offer.create`, events par contrat (ADR-0020) |
| SELL-FLOW-02 | Parcours vendeur dans Space (« mettre en vente ») | OPEN | P2 | Formulaire Space (wizard réutilisé), fiche+prix+stock soumis, statuts/feedback, rien en vente avant offre ACTIVE |
| PRICE-01 | Contrat de prix et historique | OPEN | P1 | Prix de base offre + journal append-only + `resolveEffectivePrice` ; proposé vs actif vs payé (ADR-0021, dép. SELL-FLOW-01) |
| PROMO-01 | Moteur de promotions | OPEN | P2 | % ou fixe, périodes, périmètre, éligibilité, plafonds, cumul explicite, garde-fous vendeurs (dép. PRICE-01) |
| COUPON-01 | Codes et consommation des coupons | OPEN | P2 | Codes rattachés aux promos, minima, limites globales/par client, expiration, consommation atomique (dép. PROMO-01) |
| PRICE-02 | Remises figées en commande + traçabilité | OPEN | P2 | Snapshot commercial par ligne, devise, arrondis, annulations sans réécriture (dép. PRICE-01 + PROMO-01) |

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

### PORT-UI-00 — Portfolio admin : stopper les données fabriquées
- **Statut :** OPEN · **Domaine :** Portfolio/UI admin · **Dépendances :** aucune (prérequis de PORT-UI-01/02)
- **Cadrage :** Portfolio est le **back-office d'administration du catalogue** (admins/gouverneurs plateforme, jamais vitrine publique ni saisie vendeur directe). Les vendeurs proposent des ajouts depuis le **dashboard Space** (ou équivalent à trancher) via le workflow proposals PRD-0010 ; l'admin Portfolio instruit et publie.
- **Risque :** la vitrine admin affiche des chiffres et produits inventés comme réels — dont une fiche « Xiaomi 18 Pro Max 5G (8500mAh / 1TB) » RAM **24GB** factuellement fausse qui contredit la vraie fiche `XIAOMI-18-PRO-MAX-5G` (12/16 Go) en base. Perte de confiance + décisions prises sur du faux.
- **Objectif :** aucune donnée inventée présentée comme réelle ; vocabulaire aligné domaine (`Product|Service|DigitalProduct|Experience`, `"In Review"`).
- **Critères :**
  - [ ] KPIs dashboard (12 480 / 11 920 / 48 / 91,4 % / 142), compteurs catégories, table caractéristiques, proposition `PROP-0019`, alertes 86/34/22 : supprimés ou branchés sur requêtes réelles.
  - [ ] 4 faux produits (`VND-*`, `portfolio-view.ts:17-54`) supprimés ; sinon bandeau explicite « données de démonstration ».
  - [ ] Zéro `alert()` comme action métier (9 occurrences : filtrer, approuver, import, export, fiche…).
  - [ ] Types/statuts du mock alignés domaine (fini `Subscription|DigitalAsset|InReview`).
- **Preuves :** `apps/portfolio/src/presentation/portfolio-view.ts:17-54,80-114,169-202,262-271,370-371`, `portfolio.test.ts:189-198` (asserts sur mocks à réécrire, cf. PORT-UI-07).
- **Prochaine action :** purger les mocks d'abord (la suppression précède le branchement), puis PORT-UI-01.

### SHELL-SEC-01 — Shell : vérifier les frontières de sécurité
- **Statut :** OPEN · **Domaine :** Shell/Sécu · **Dépendances :** AUTH-E2E (sessions réelles)
- **Risque :** 4 autorités de permissions (`profiles.permissions`, `shellRegistry`, `requiredPermissions`, `BAC_ACCESS_POLICY`) + `tenantId: "default"` hardcodé (`src/start.ts`) → un endpoint `/api/*` ou un chemin SSR pourrait autoriser une action refusée par la policy. Divergences connues (`solara:read:feed` vs `solara:feed:read`, `booking:*`) = indices, pas encore preuves.
- **Objectif :** prouver ou infirmer, par BAC et par endpoint, que guard SSR + handlers API + contrôles tenant appliquent la même règle ; corriger toute divergence exploitable avant tout refactoring visuel.
- **Critères :**
  - [ ] Inventaire des permissions réelles (grep + manifests + descripteurs) et matrice de divergence versée au rapport.
  - [ ] Chaque handler `src/server/routes/*.ts` : contrôle d'accès documenté (qui, quel rôle, quel tenant) ; écart = bug P0.
  - [ ] Chemins SSR vérifiés : anonyme (`/` → `/commerce`, vues protégées → login), authentifié non-admin → `imperia` 403, `tenantId` non contournable.
  - [ ] Aucune décision basée sur `allowedBacs` côté serveur hors projection d'affichage (`buildNavProfile`).
- **Preuves :** `src/shell/bac-access.ts`, `src/shell/profiles.ts`, `src/shell/renderer.ts:72-117,424-429`, `src/shell/contextual-actions.ts`, `src/start.ts`, `src/server/routes/` — rapport d'audit + tests.
- **Prochaine action :** inventaire permissions + audit ciblé des routes `/api/*` en lecture seule, puis tests d'intrusion logiques (cf. SHELL-INV-01).

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
- **Note 2026-10-12 :** implémentation concrète = PORT-UI-01 (grille+search) + PORT-UI-02 (fiche). PRD-0011-A reste le jalon, PORT-UI-* le travail.

### PORT-UI-01 — Portfolio admin : catalogue + recherche sur données réelles
- **Statut :** OPEN · **Domaine :** Portfolio/UI admin · **Dépendances :** PORT-UI-00 (mocks purgés)
- **Objectif :** grille d'administration paginée + recherche branchées sur `PortfolioService.search()` (données PG normalisées, 35 fiches réelles) : **tous statuts visibles** (Draft → Published), tri/flags par complétude et qualité, accès restreint admin (jamais de parcours acheteur ici).
- **Critères :**
  - [ ] Grille rendue depuis `search()` (référence, nom localisé, statut workflow réel, complétude `quality.completeness` recalculée).
  - [ ] Recherche par nom/référence + facettes catégorie/tag/statut fonctionnelles (requêtes, pas `alert()`).
  - [ ] Pagination réelle (`limit`/`offset` du service).
  - [ ] États vides honnêtes (0 résultat → message, jamais de faux).
- **Preuves :** `portfolio-service.ts` (`search`), `postgres-vendable-repository.ts` — test E2E SSR à joindre.
- **Prochaine action :** brancher la grille d'abord, les facettes ensuite.

### PORT-UI-02 — Portfolio admin : page fiche détail
- **Statut :** OPEN · **Domaine :** Portfolio/UI admin · **Dépendances :** PORT-UI-00, PORT-UI-01
- **Objectif :** une URL par fiche exposant tout le PIM réel + **actions de workflow admin** selon statut (valider/publier/archiver/repasser en Draft — jamais d'achat, jamais de prix).
- **Critères :**
  - [ ] Route fiche (`/portfolio/:reference`) : contenu localisé FR (fallback EN), `characteristics.specifications` groupées, `classification`, `seo` (slug/meta).
  - [ ] Variantes listées (SKU + attributs descriptifs, sans prix/stock — frontière PIM).
  - [ ] Galerie `media_assets` avec `<img>` + alt (fini 0 image rendue).
  - [ ] Bloc options ADR-0019 (groupes, valeurs, incompatibilités affichées).
  - [ ] Score `quality.completeness` + champs manquants réels (remplace le 91,4 % fictif).
  - [ ] Actions workflow câblées aux transitions autorisées (pas d'`alert()`).
- **Preuves :** tables `translations/media_assets/variants/vendable_features/variation_groups` — capture à joindre.
- **Prochaine action :** fiche lecture seule d'abord (édition = wizard, cf. PORT-UI-03).

### SELL-FLOW-01 — Approbation vendeur atomique (vendable + offre + events)
- **Statut :** OPEN · **Domaine :** Portfolio/Commerce (backend) · **Dépendances :** aucune (DB partagée déjà en place) · **Décision :** ADR-0020
- **Risque :** approbation partielle visible (vendable publié sans offre) = contrat vendeur rompu ; double-clic/retry = double offre ; `transaction()` imbriquée = atomicité illusoire (piège vérifié : savepoints sur pool partagé, jamais sur la connexion du `BEGIN`).
- **Objectif :** une approbation commerciale réussie ⇒ vendable + offre + events vérifiables, sinon rien de visible. Jamais de tx SQL imbriquée : saga séquentielle top-level + contraintes DB comme arbitres.
- **Critères :**
  - [ ] `commercialTerms` (dernière version soumise, éditable Draft/ChangesRequested) + `approvedTerms` (snapshot exact consommé) + `offerId` + `auditTrail` append-only sur Proposal ; migration `portfolio.catalog.v1.007` ; `updateDraft` accepte les termes.
  - [ ] `OfferProvisioningPort` injecté (optionnel) ; parcours commercial sans port câblé → `approve()` lève explicitement (jamais de repli silencieux) ; non-commercial inchangé.
  - [ ] `approve()` : termes validés (prix>0, devise `[A-Z]{3}`, stock ≥ 0 — bloquant) → vendable créé-ou-retrouvé (reprise sur référence dupliquée) → offre créée-ou-retrouvée (`proposalId` + UNIQUE partiel, reprise sur 23505) → `Approved` + ids + snapshot → events publiés selon contrats (`portfolio.vendable.published` sans commercial, nouveau `commerce.offer.activated` avec commercial).
  - [ ] `commerce.offer.create` exposée en capability + permission + schéma d'event déclaré ; vendeur `{type:"space"}` vérifié (`isUserAdmin` ou rôle vendeur, identité serveur).
  - [ ] Tests : échec à chaque étape (termes invalides, port absent, offre en échec → pas d'`Approved`), retry/timeout/double-clic → 1 seule offre, approbations concurrentes convergent, accès inter-Space refusé, statuts invalides rejetés.
- **Preuves :** `proposal-service.ts` (`approve`), `commerce-offer.model.ts`, migration v1.007, tests à joindre.
- **Prochaine action :** migration + port + saga d'abord (sans UI), UI ensuite (SELL-FLOW-02, PORT-UI-04).

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
  - [ ] `apps/portfolio/src/infrastructure/postgres-vendable-repository.test.ts` (« une ligne de catalogue par code canonique ») : rouge 2× le 2026-10-11 (run isolé + suite complète), vert au re-run isolé sans changement de code — flaky avéré, cause non investiguée (piste : alignement `params[]`/`seen.statements` via `transaction`, cf. analyse dogfooding portfolio).
 - **Prochaine action :** traiter CLI-lifecycle d'abord (vrai bug potentiel), puis re-qualifier le boot HTTP sur DB migrée.

### SEC-DEPS — Assainir dépendances vulnérables (audit santé 2026-10-11)
- **Statut :** OPEN · **Domaine :** Sécu/Deps · **Dépendances :** aucune (dev-only)
- **Constat :** `pnpm audit` = 27 GHSA distincts dont ≥2 critical lus (`GHSA-5xrq-8626` vitest UI <3.2.6 via `apps/solidarity vitest@1.6.1` pin `^1.3.0` et `apps/subscription vitest@2.1.9` pin `^2.0.0` — racine `3.2.7` patchée ; tinypool RCE en transitif). Preuve : `.project/reports/repository-health-report.md` § Security.
- **Critères :**
  - [ ] `solidarity` + `subscription` montés en `vitest ^3`, `pnpm install`, leurs suites vertes.
  - [ ] Les 27 GHSA triés (corriger / accepter-risquer-daté / faux-positif) ; 0 critical/high restant sans décision datée.
  - [ ] Gate CI `pnpm audit --audit-level=high` (ou `pnpm audit --prod` + dev séparé).
- **Prochaine action :** monter les 2 pins vitest d'abord (fix isolé, blast radius tests seuls), puis trier le reste.

### SHELL-PERM-01 — Shell : source canonique des permissions
- **Statut :** OPEN · **Domaine :** Shell/Archi · **Dépendances :** SHELL-SEC-01 (inventaire)
- **Risque :** centraliser dans un fichier ne suffit pas si chaque couche réinterprète ; les types TS seuls ne remplacent ni l'autorisation runtime ni les contrôles DB.
- **Objectif :** un contrat canonique typé (`BacId`, `Permission`, IDs réels issus de l'inventaire), vérifications statiques + contrôles serveur faisant autorité + refus explicite sur inconnu.
- **Critères :**
  - [ ] Définition canonique des IDs BAC et permissions (pas de liste inventée, issue de SHELL-SEC-01).
  - [ ] `BacDescriptor.requiredPermissions` typé sur le canonique ; représentations shell/serveur dérivées ou validées.
  - [ ] Tests qui détectent permissions inconnues, alias (`identity`/`citadelle`, préfixe `@apps/`) et incohérences entre les 4 autorités.
  - [ ] Politique de refus explicite sur information manquante/invalide.
- **Preuves :** contrat canonique + tests verts + rapport de convergence des 4 sources.
- **Prochaine action :** figer l'inventaire (SHELL-SEC-01), puis typer et tester.

### SHELL-UI-01 — Shell : réparer le validateur UI (faux-vert)
- **Statut :** OPEN · **Domaine :** Shell/CI · **Dépendances :** aucune
- **Risque :** `scripts/validate-ui-contracts.ts` compte les `mosaix.json` et sort toujours 0 → fausse assurance CI avant tout changement shell.
- **Objectif :** une vérification qui échoue pour de vrai, ou un retrait explicite de la CI.
- **Critères :**
  - [ ] Échoue sur contrat manquant ou invalide (champs requis, icône, route, `showInNavigation`), avec fixtures positif/négatif démontrant la détection.
  - [ ] À défaut : retiré de `pnpm check` + mention explicite « pas de validation UI » (pas de faux-vert silencieux).
- **Preuves :** `scripts/validate-ui-contracts.ts`, fixtures, log CI.
- **Prochaine action :** ajouter 2 fixtures (valide/invalide) et faire rougir le script dessus d'abord.

### SHELL-INV-01 — Shell : suite d'invariants production
- **Statut :** OPEN · **Domaine :** Shell/Test · **Dépendances :** SHELL-SEC-01 (règles à verrouiller)
- **Objectif :** verrouiller les 7 invariants flockés avec `bac-access.test.ts` / `guest-surfaces.test.ts`, sur identités et configs représentatives (pas de mocks rejouant les hypothèses du code).
- **Critères :**
  - [ ] Anonyme → opération protégée en appel API direct : refus.
  - [ ] Authentifié → BAC d'un autre rôle : refus (SSR + API).
  - [ ] Tenant A ≠ lecture/écriture tenant B.
  - [ ] BAC annoncé opérationnel ne retombe jamais silencieusement sur service mémoire.
  - [ ] Actions affichées en navigation = actions réellement autorisées.
  - [ ] Zéro seed démo exposé avec `MOSAIX_DEMO_USERS=false`.
  - [ ] Mutations feed (dont likes) cohérentes UI → API → persistance (aujourd'hui `likePost()` DOM seul).
- **Preuves :** suite d'intégration dédiée + rapport d'exécution.
- **Prochaine action :** écrire les 3 premiers invariants (anonyme, rôle, tenant) avant le wiring.

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
