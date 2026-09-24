# MosaiX Dashboard
**Dernière mise à jour :** 2026-09-24 — Vérification `af20893` + `1dd2342`  
**Statut Global :** 🟡 Partiel — `EffectivePermissionResolver` + `Money/Timestamp` + schémas commerce/beam/booking/citadelle/subscription livrés ; `PermissionRegistry`, `roles/role_permissions`, `solidarity/solara`, `Money` wiring et `DATA-07/08` restent ouverts


---

## 1. Métriques Clés

- **Bounded Application Components (BACs) :** 10 (`citadelle`, `solara`, `solidarity`, `imperia`, `spaces`, `commerce`, `beam`, `portfolio`, `booking`, `subscription`)
- **Contrats de Contributions UI :** 26 enregistrés et isolés
- **Validation Manifestes & Graphe Topologique :** 10/10 validés
- **Thèmes Validés :** 2 (`midnight-ocean`, `mosaix-default`)
- **Compilation & Linters :** 0 erreur, 0 warning

---

## 2. Vérification Dernier Commit `af20893` + `1dd2342` (2026-09-24)

- ✅ **P1-02 `EffectivePermissionResolver` (`@mosaix/core`)** : `PermissionDecision{allowed, matchedPermission, effect, source}`, `UserAuthorizationContext{authorizationVersion, generatedAt, allows, denies, decisionMap}`, `matchPermissionPattern` wildcard, `buildContext` + `bumpVersion(userId:spaceId)`, `can()` `DENY>ALLOW` absolu — 4 tests `effective-permission-resolver.test.ts` verts (refund deny, override, version).
- ✅ **DATA-06 `Money`/`Timestamp`** : `Money.fromCents/fromAmount add/subtract toJSON` + `Timestamp toIso/toEpochMs` — `value-objects.test.ts` 3 tests verts ; wiring domaine (`commerce-offer.model.ts:19` etc.) reste à faire.
- ✅ **DATA-02/03/04 Commerce/Beam** : `commerce_offers/payment_intents/auctions/bids/carts/cart_items` (7 tables), `beam_messages` enrichi `replyTo/thread/reactions/attachments/encryptedPayload` + `beam_notifications/push_subscriptions`.
- 🟠 **DATA-01/05 Partiels** : `portfolio_vendables` 13 cols + `categories/variants` OK (manque `translations/relations/media`), `booking_waitlists/reminders` + `citadelle roles/mfa_secret` + `coupons/invoices/metering` OK — **manquent** `solidarity_*` 7 tables + `solara_*` `categories/translations` + `PermissionRegistry` (ROLE-P1-01).
- 🔴 **Restant** : `PermissionRegistry` `permission.ts:21`, `roles/role_permissions/global_user_roles/space_members/permission_overrides/acting_as_audit_events` (P2-P7), `Money` wiring + `DATA-07/08`.
- ⚠️ Correction : le statut précédent "Implémentation Intégrale des Modèles" supprimé — **non intégrale**, voir backlog §7.

## 3. Backlog Actif (16 tâches) — Synthèse

- **ROLE** : P1-02 ✅, P1-01/P2-P7+AUDIT 🔴 (voir backlog §5+§7)
- **DATA** : DATA-02/03/04 ✅, DATA-01/05/06 🟠, DATA-07/08 🔴 (voir backlog §6+§7)

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



