# MosaiX / IJIDeals — BACKLOG (pilotage livraison)

- **Dernière mise à jour :** 2026-10-12 — mise à jour complète suite aux livraisons `PRICE-02`
- **Principe :** ce fichier répond à « Que doit-on faire ensuite ? ». L'historique vit en `.project/archive/`, les décisions en `.project/decisions/`, l'architecture en `.project/architecture/` et `apps/*/responsibilities.md`.
- **Règle de comptage :** le nombre de tâches ouvertes se recompte depuis le registre ci-dessous, jamais depuis un paragraphe manuel.

## Vue d'ensemble (un coup d'œil)

| ID | Titre | Statut | Pri | Prochaine action |
|---|---|---|---|---|
| MCP-03c | Vérification Bearer cryptographique MCP | DONE | P0 | Validé par tests d'authentification cryptographiques JWT (`JwtService`) |
| AUCTION-PERSIST | Persister le moteur d'enchères | DONE | P0 | Validé par `PostgresAuctionRepository` + `SELECT FOR UPDATE` + tests de concurrence |
| AUTH-E2E | Preuves auth réelle sur PG | VERIFY | P0 | E2E restart (valide survit, révoquée rejetée) + guard `InMemorySecretsAdapter` (`citadelle/index.ts:160`) + e2e login/logout/session |
| DB-PGSQL-E2E | `db:setup` vert sur Postgres réelle | VERIFY | P0 | Câbler `PgClient` réel derrière `DB_CONNECTION=pgsql` + e2e ledger + seeds |
| BOUND-02 | Extraire Payments derrière `PaymentPort` | DONE | P0 | `UnifiedPaymentPort` formalisé dans `satim-payment-port.ts` |
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
| SHELL-SEC-01 | Shell : vérifier les frontières de sécurité | OPEN | P0 | Permissions effectives + handlers `/api/*` + multi-tenant + chemins SSR ; corriger toute divergence exploitable |
| SHELL-PERM-01 | Shell : source canonique des permissions | DONE | P1 | Catalogue `CANONICAL_BAC_IDS` et helpers de validation ajoutés |
| SHELL-UI-01 | Shell : réparer le validateur UI (faux-vert) | DONE | P1 | Valideur de contrats UI réparé et exécuté avec succès |
| SHELL-INV-01 | Shell : suite invariants production | DONE | P1 | Suite de tests d'invariants de production ajoutée dans `tests/shell-production-invariants.test.ts` |
| SHELL-BAC-01 | Shell : statut explicite par BAC + wiring ciblé | OPEN | P2 | Matrice persistance/autorisation/cycle de vie/API/UX/tests par BAC |
| SHELL-TRUTH-01 | Shell : supprimer les comportements trompeurs | OPEN | P2 | Compteurs fictifs, likes no-op, home-page morte : retirer ou expliciter |
| SHELL-RENDER-01 | Shell : découper `renderer.ts` sans changer le comportement | OPEN | P2 | Caractérisation d'abord, CTA déclaratifs, suppression fallback `allowedBacs` (complète HYGIENE-SHELL) |
| SELL-FLOW-01 | Approbation vendeur atomique (vendable + offre + events) | DONE | P1 | Saga `ProposalService.approve()` avec `OfferProvisioningPort` et création atomique de vendable/offre |
| SELL-FLOW-02 | Parcours vendeur dans Space (« mettre en vente ») | DONE | P2 | Formulaire de mise en vente marchand `view=sell` implémenté dans `spaces-view.ts` |
| PRICE-01 | Contrat de prix et historique | DONE | P1 | Prix de base offre + journal append-only `priceHistory` + `resolveEffectivePrice()` (ADR-0021) |
| PROMO-01 | Moteur de promotions | DONE | P2 | Implémenté via `PromotionEngine` dans `promotion-engine.ts` |
| COUPON-01 | Codes et consommation des coupons | DONE | P2 | Implémenté via `CouponService` dans `coupon-service.ts` |
| PRICE-02 | Remises figées en commande + traçabilité | DONE | P2 | Freeze commercial line item snapshot dans `OrderService.createOrder()` |
| AUTH-05 | Projection identité session→profil (IdentityProfilePort) | OPEN | P1 | `context.user.id` d'exécution = identité de session (commandes scoped, espaces) — cf. revue commerce-view |
| COMMERCE-CART-01 | Backend panier réel (création/mutation/validation prix+stock) | OPEN | P2 | CTA actuel = badge honnête « bientôt disponible » ; checkout revalide prix+stock (BOUND-02) |
| VUES-AUTHFLAG-01 | Brancher `isAuthenticated` dans les vues restantes (spaces, etc.) | OPEN | P2 | Même P1 rôles≠auth que commerce-view ; contrat déjà requis dans `BacExecutionContext` |
