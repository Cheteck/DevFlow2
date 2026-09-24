# MosaiX Dashboard
**Dernière mise à jour :** 2026-09-23  
**Statut Global :** 🟢 Système Nominal (Toutes les actions du backlog sont implémentées et archivées dans `.project/archive/completed-backlog-history.md`)


---

## 1. Métriques Clés

- **Bounded Application Components (BACs) :** 10 (`citadelle`, `solara`, `solidarity`, `imperia`, `spaces`, `commerce`, `beam`, `portfolio`, `booking`, `subscription`)
- **Contrats de Contributions UI :** 26 enregistrés et isolés
- **Validation Manifestes & Graphe Topologique :** 10/10 validés
- **Thèmes Validés :** 2 (`midnight-ocean`, `mosaix-default`)
- **Compilation & Linters :** 0 erreur, 0 warning

---

## 2. Gaps Résolus & Améliorations Récentes

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



