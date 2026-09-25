# MosaiX Dashboard
**Dernière mise à jour :** 2026-09-24 — Pull `ac99009`/`0ebe478`/`356422d` + PRD-0011 complet + PRDs v1.3  
**Statut Global :** 🟢 Système Nominal — Moteur d'Autorisation v2, 14 tables Portfolio CS-Cart, `portfolio_proposals` + `ProposalService` (`PRD-0010` v1.3), `Money`/`Timestamp` livrés ; reste `DATA-07/08` + `THEME` UI + `PRD-0011` 19 pages


---

## 1. Métriques Clés

- **Bounded Application Components (BACs) :** 10 (`citadelle`, `solara`, `solidarity`, `imperia`, `spaces`, `commerce`, `beam`, `portfolio`, `booking`, `subscription`)
- **Contrats de Contributions UI :** 26 enregistrés et isolés
- **Validation Manifestes & Graphe Topologique :** 10/10 validés
- **Thèmes Validés :** 2 (`midnight-ocean`, `mosaix-default`)
- **Compilation & Linters :** 0 erreur, 0 warning

---

## 2. Synthèse des Livraisons Rôles & Modèles (2026-09-24)

- ✅ **ROLE-P1-01 `PermissionRegistry` (`@mosaix/core`)** : Support de `registerPermission({ key, description, scopes, assignableBy })`, `isRegistered`, `getRegistered`, et validation stricte des permissions atomiques.
- ✅ **ROLE-P1-02 `EffectivePermissionResolver` (`@mosaix/core`)** : Moteur de résolution avec règle prioritaire `DENY > ALLOW`, contextes de snapshot `UserAuthorizationContext`, horodatage et versioning `authorizationVersion`.
- ✅ **ROLE-P2..P7 RBAC, Dynamique & Audit** : Migrations Postgres pour `permissions`, `roles`, `role_permissions`, `global_user_roles`, `space_members`, `permission_overrides`, `acting_as_audit_events` et `role_audit_events`.
- ✅ **DATA-08 Typer les `Record<string,unknown>`** : Implémentation des schémas Zod stricts (`VendableCharacteristicsSchema`, `MediaItemMetadataSchema`, `CommerceOfferMetadataSchema`, `PostMetadataSchema`, `AuditLogMetadataSchema`) dans `@packages/schemas`.
- ✅ **CIB-01 Paiements SATIM CIB & Wallet Escrow** : Implémentation de `SatimPaymentPort` (SATIM CIB/Edahabia) et `WalletEscrowManager` avec gestion d'escrow, recharge et calcul de commissions platform.
- ✅ **SHELL-01 BAC par défaut & Orchestration Découplée** : Mise en place de `PlatformSettings` / `PlatformSettingsService` (résolution 3-tiers DB/Env/Code), contrat `BacDescriptor` unifié, et moteur `BacOrchestrator` dans le Shell. Montage autonome du BAC par défaut sans dépendance statique envers Solara.
- ✅ **PRD-0010 Proposals v1.3 simplifiée** : `portfolio_proposals` 1 table mutable (contenu courant écrasé, `platform_feedback`, `vendable_id NULL→V987`) + `ProposalService` 7 méthodes `createDraft→approve` (`356422d`, 197L) — sans `proposal_revisions`, audit externe.
- ✅ **PRD-0011 Portfolio complet** : PRD `PRD-0011-portfolio.md` v1.0 + §10 MeshJS `G:\MeshJS-by-Jules\apps\catalog` (`CatalogEngine` 12 repos, `CategoryEngine.getParentChain`, `StickerEngine` 4 conditions) + `themeContract` 10 BACs (`2395e23`).
- ✅ **Commerce source unique offre/stock/prix** : `portfolio_variants` abstrait sans `price/stock` (`FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61`), `CommerceOffer` `priceInCents/commissionRateBps/stockAllocation` + `Money` VO seule vérité (`commerce:offer:create`).
- ✅ **Paiements COD Algérie + Wallet** : `commerce_payment_intents` `cod_pending→cod_delivered→succeeded` par défaut, `CheckoutOrderWorkflow` `AuthorizePayment` no-op pour COD, wallet escrow `wallets/wallet_transactions` prévu moyen terme (`escrow_hold→release`).
- ✅ **BAC Livraison** : extraction `delivery-partner.service.ts` → `@apps/delivery` `delivery_methods(cod|express|pickup) + delivery_boys + deliveries + assignments` (`out_for_delivery→delivered` + `proofUrl` + `codAmountInCents`).

## 3. Statut du Backlog Actif
- **Statut Global** : 12/17 livrées (ROLE, DATA-01..06/09, PRD-0010 DB) — restent `DATA-07` triggers, `DATA-08` `Record<string,unknown>`, `THEME` UI `CompositionResolver.themeContext`, `PRD-0011` 19 pages (DB done, UI à faire).


## 4. Gaps Résolus & Améliorations Récentes (archive)

- ✅ **P0 - Micro QueryBuilder DML Typé (`@mosaix/ports-database`)** : Moteur de requêtes typées (`SelectQueryBuilder`, `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder`) avec binding automatique anti-injection ($1/$2 pour Postgres, ? pour SQLite).
- ✅ **P0 - Gestionnaire de Pool PostgreSQL (`PostgresPoolManager`)** : Support de pooling de connexions, health check automatique (`SELECT 1`), retries sur erreurs transitoires et fermeture propre.
- ✅ **P0 - Passerelle de Paiement Webhook (PSP)** : Intégration de `PspWebhookHandler` (`/api/psp/webhook`) avec vérification cryptographique HMAC-SHA256 pour les événements Stripe / Adyen / Mollie.
- ✅ **P0 - Navigation Mobile & Accessibilité WCAG 2.1 AA** : Intégration de `renderMobileDrawer` avec slide-over responsive (<640px) et balisage ARIA universel (`role="banner"`, `role="navigation"`, `role="main"`).
- ✅ **P0 - Interface Droit à l'Oubli (RGPD)** : Intégration de la vue `IdentityGdprPrivacyPageView` (`/identity/privacy`) permettant à l'utilisateur de déclencher l'anonymisation de ses données avec confirmation et retour visuel.
- ✅ **P0 - Clustering Événements Distribués** : Extension de `DistributedEventBackplane` avec interface `ClusterTransportAdapter` (prêt pour Redis Pub/Sub et NATS multi-nœuds).
- ✅ **P1 - Protection Anti-Abus & Rate Limiting** : Ajout du Token Bucket Rate Limiter (`standardRateLimiter` et `strictRateLimiter`) sur les routes sensibles (`/api/*`).
- ✅ **P1 - Standardisation des Erreurs HTTP (RFC 7807)** : Réponses d'erreurs d'API standardisées au format `application/problem+json` via `sendProblemResponse`.
- ✅ **P1 - Cache de Fragments SSR** : Module `FragmentCache` LRU avec TTL pour l'accélération du rendu côté serveur.
- ✅ **P0 - Scalabilité SQLite** : Mode WAL, busy_timeout 5000ms et pragma `synchronous=NORMAL` activés.
- ✅ **P0 - Sécurité Cryptographique** : `SecurityGuard` avec vérification stricte des secrets JWT en production.
- ✅ **P1 - Keyset Pagination** : `FeedService` avec pagination par curseur d'horodatage sur `/api/feed`.
- ✅ **P1 - Phase 23 (Subscriptions & Billing)** : Création complète du 10ème BAC `@apps/subscription` avec forfaits récurrents, metering et contrôle d'accès par capability-gating.
- 🚀 **Phase 25 (BAC Domain Evolution & Hardening)** : Évolution et durcissement livrés sur les 10 BACs (Scrypt/lockout & RGPD Citadelle, State Machine & PaymentIntent & Offres Agnostiques multi-entités Commerce, Recherche à facettes & pricing variants Portfolio, Pipeline modération 3-tiers & parseur tags Solara, iCalendar RFC 5545 & Waitlist Booking, Matching géospatial & Merkle audit trail Solidarity, E2E Crypto ECDH/AES-GCM & bots Beam, Custom domain DNS/SSL & usage tracker Spaces, Compliance SOC2/HIPAA/GDPR & GitOps drift detector Imperia, Prorata & dunning schedule Subscription).
- ✅ **BAC-COM-07 - Offres Agnostiques de Vendables** : Le Bounded Application Component `commerce` prend désormais en charge les offres (`CommerceOffer`) de manière totalement agnostique pour toute entité vendeuse (`SellerEntityRef` : `space`, `tenant`, `user`, `collective`, etc.) avec cycle de vie d'offre, allocation de stock, calcul de commission et routage de paiement.
- 🛡️ **Phase 26 - Infrastructure, RLS Natif & Sécurité Avancée** : Schémas PostgreSQL canoniques par BAC (`PostgresBacSchemaMigrator`), Row Level Security natif (`PostgresRlsManager`), `SchemaBuilder.inSchema()`, hasher Bcrypt / Argon2 (`Citadelle`), Saga de réservation et compensation de stock (`Commerce`), import CSV avec validation (`Portfolio`), portail prestataire SSR (`Booking`), antivirus et legal hold (`Beam`), domaine personnalisé avec HSTS/ACME Let's Encrypt et SCIM (`Spaces`), règles de gouvernance déclaratives Rego (`Imperia`), metering Redis sorted sets et reconnaissance de revenus ASC 606 (`Subscription`), ADR-0014 et diagrammes d'architecture C4.
- 🧩 **Phase 27 - Plugin Engine Optimal (Priorités 1 à 8)** : 
  1. `HookExecutionEngine` (`runHook(point, args)` en waterfall/parallel/bail, priorités, timeout).
  2. `WorkspacePluginLoader` (scan `plugins/**/mosaix.json`, watch, hot reload/unload).
  3. `PluginSandboxEnvironment` (isolation Realm/VM, timeout threshold et containment global).
  4. `PluginCapabilityResolver` (résolution `requiresCapabilities` au register, injection de ports réels).
  5. `PluginSettingsValidator` & `PluginSettingsManager` (validation JSON Schema, types, defaults, réactivité `onChange`).
  6. `PluginEventBus` (bus d'événements `plugin:event` inter-plugins avec wildcard patterns et isolation).
  7. `PluginCliCommandRunner` (`mosaix plugin install|update|remove|list|dev`).
  8. `PluginMarketplaceRegistry` (index distant, résolution semver `^1.0.0`, vérification d'intégrité SHA-256 et signature cryptographique HMAC/RSA).



