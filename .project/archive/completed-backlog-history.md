# MosaiX Platform — Completed Backlog Archive
Date d'archivage : 2026-09-23

---

## 1. Fondations & Infrastructure Développeur (Phases 1 à 20)
- ✅ **Phases 1-16** : Runtime Kernel, Gateway, Pipeline Middleware, Inversion de Contrôle Container, Manifestes Bounded Apps, SQLite WAL / Busy Timeout, Sécurité JWT HMAC-SHA256, Adaptateurs Postgres 8 BACs, Cache Redis, Traçabilité OTLP.
- ✅ **Phases 17-20** : Rate Limiting distribué Redis, Résolution de secrets Vault, Isolation Multi-tenant par schéma SQL, Export télémétrique OTLP / Prometheus.
- ✅ **Phases P1-P8** : Auth JWT fail-fast, Persistance adaptative Postgres/SQLite, Durcissement CORS et Headers, Métriques Prometheus, Suite de tests d'intégration, Pipeline CI/CD.
- ✅ **Phase IHM (UniTheme)** : Persistance du thème `.mosaix/composition-overrides.json`, Import/Export JSON Presets, Solara Post Composer et Widgets Showcase.
- ✅ **Phase 21 (Événements & Outbox)** : OutboxWorker avec partitionnement Kafka / RabbitMQ et fallback mémoire (`src/outbox-daemon-boot.ts`, `scripts/outbox-worker.ts`).
- ✅ **Phase 23 (Abonnements & Forfaits)** : Bounded Application Component `@apps/subscription` avec plans récurrents, facturation métrique et capability-gating.
- ✅ **Phase 24 (Modèles de Monétisation)** : Compteurs à l'usage, commissions marketplace multi-vendeurs et intégration checkout.

---

## 2. Dogfooding & Remédiations Historiques (BL-010 à BL-023)
- ✅ **BL-010** : `AuthorizationEngine` et `PermissionGuard` branchés dans la Gateway.
- ✅ **BL-011** : `PermissionGuard` middleware avec validation JWT stricte.
- ✅ **BL-012** : 8 adaptateurs Postgres créés et branchés (`PostgresUserRepository`, `PostgresVendableRepository`, `PostgresOrderRepository`, `PostgresSpaceRepository`, `PostgresSocialRepository`, `PostgresMessagingRepository`, `PostgresSolidarityRepository`, `PostgresImperiaRepository`).
- ✅ **BL-013** : `AuthManager` avec stores adaptatifs dans `IdentityServiceProvider`.
- ✅ **BL-014** : `OTLPTraceExporter` réel dans la Gateway.
- ✅ **BL-015** : Imports normalisés via `@mosaix/sdk` dans l'ensemble des BACs.
- ✅ **BL-016** : Événements domaine branchés via `OutboxWorker`.
- ✅ **BL-017** : `PostgresSocialRepository` (Solara) aligné sur le modèle `Post`/`Comment`/`FollowerRelation`.
- ✅ **BL-018** : `PostgresMessagingRepository` (Beam) aligné et typé avec pagination.
- ✅ **BL-019** : `PostgresSolidarityRepository` aligné sur les modèles d'incidents, besoins et ressources.
- ✅ **BL-020** : `PostgresImperiaRepository` avec interfaces d'audit et politiques de conformité.
- ✅ **BL-021** : `PostgresVendableRepository` avec hydratation typée.
- ✅ **BL-022** : Stores Identity persistants au boot.
- ✅ **BL-023** : Worker Outbox indépendant avec tests unitaires.

---

## 3. Phase 25 — Évolution & Durcissement des 10 Bounded Contexts (BACs)

### citadelle (Identité & IAM)
- ✅ **BAC-CIT-01** : Modèle utilisateur enrichi (`passwordHash`, `roles`, `emailVerified`, `lastLoginAt`, `mfaEnabled`, `mfaSecret`).
- ✅ **BAC-CIT-02** : Hachage cryptographique fort (`ScryptPasswordHasherAdapter`) et garde anti-brute force (`AccountLockoutGuard`).
- ✅ **BAC-CIT-03** : Rotation et révocation des sessions (`SessionTokenManager`).
- ✅ **BAC-CIT-04** : Fournisseurs externes OAuth/OIDC Google, GitHub, Microsoft (`CitadelleOAuthManager`).
- ✅ **BAC-CIT-05** : Événements domaine IAM (`UserCreated`, `UserUpdated`, `PasswordChanged`, `MfaEnabled`).
- ✅ **BAC-CIT-06** : Conformité RGPD (`anonymize`, `exportData`, `deleteData`).

### commerce (Commandes & Checkout)
- ✅ **BAC-COM-01** : Modèle `OrderModel` étendu (devises, adresses, taxes, remises, `lineItems`).
- ✅ **BAC-COM-02** : Machine à états de commande déterministe `OrderStateMachine`.
- ✅ **BAC-COM-03** : Abstraction de paiement `PaymentIntent` avec capture et remboursements partiels.
- ✅ **BAC-COM-04** : Réservation de stock via événement `commerce.inventory.reserve`.
- ✅ **BAC-COM-05** : Événements de cycle de commande (`OrderCreated`, `OrderPaid`, `OrderShipped`, etc.).
- ✅ **BAC-COM-06** : Saga checkout avec compensation idempotente.
- ✅ **BAC-COM-07** : Offres agnostiques de vendables (`CommerceOffer`, `CommerceOfferService`, `SellerEntityRef` pour Spaces/Tenants/Users).

### portfolio (Vendables & Catalogue)
- ✅ **BAC-POR-01** : Modèle enrichi (`pricing`, `inventory`, `seo`).
- ✅ **BAC-POR-02** : Statuts de workflow étendus (`NeedsApproval`, `Scheduled`, `Expired`).
- ✅ **BAC-POR-03** : Gestion des variants de prix, stocks et médias.
- ✅ **BAC-POR-04** : Port de recherche à facettes dynamiques `PortfolioSearchPort`.
- ✅ **BAC-POR-05** : Import/export bulk CSV et JSON (`PortfolioBulkExporter`, `PortfolioBulkImporter`).
- ✅ **BAC-POR-06** : Gestionnaire de médias CDN avec URLs signées et conversion WebP (`PortfolioMediaManager`).

### solara (Réseau Social & Pulse)
- ✅ **BAC-SOL-01** : Pipeline modulaire de modération en 3 étapes `SolaraModerationPipeline`.
- ✅ **BAC-SOL-02** : Algorithme de tri de flux par score d'engagement et décroissance temporelle `FeedScoringEngine`.
- ✅ **BAC-SOL-03** : Parseur de mentions `@user` et tags `#hashtag` (`MentionsAndTagsExtractor`).
- ✅ **BAC-SOL-04** : Prévisualisation et parsing de métadonnées OpenGraph (`OpenGraphEmbedParser`).
- ✅ **BAC-SOL-05** : Gestion de groupes avec niveaux de visibilité public/privé/secret.
- ✅ **BAC-SOL-06** : Diffuseur temps réel d'événements `SolaraRealtimeNotifier`.
- ✅ **BAC-SOL-07** : Suivi des métriques sociales `SolaraAnalyticsTracker`.

### booking (Réservations & Créneaux)
- ✅ **BAC-BKG-01** : Générateur de calendrier iCalendar RFC 5545 (`IcsCalendarGenerator`).
- ✅ **BAC-BKG-02** : Prise en charge d'empreinte bancaire `PaymentIntent`.
- ✅ **BAC-BKG-03** : Planification automatique des rappels T-24h et T-1h (`BookingReminderScheduler`).
- ✅ **BAC-BKG-04** : Tableau de bord de statistiques et réservations prestataire.
- ✅ **BAC-BKG-05** : File d'attente automatisée FIFO avec réallocation dynamique `BookingWaitlistManager`.
- ✅ **BAC-BKG-06** : Allocateur multi-ressources (salles, staff, équipements) sans collision `MultiResourceAllocator`.
- ✅ **BAC-BKG-07** : Moteur analytique des créneaux (taux d'occupation, no-show) `BookingAnalyticsEngine`.

### solidarity (Humanitaire & Crises)
- ✅ **BAC-SLD-01** : Géolocalisation PostGIS/GeoJSON et rayon de couverture.
- ✅ **BAC-SLD-02** : Algorithme d'appariement automatique géospatial `SolidarityMatchingEngine`.
- ✅ **BAC-SLD-03** : Chaînage cryptographique immuable `MerkleAuditTrail` pour preuves de distribution.
- ✅ **BAC-SLD-04** : File d'attente d'intervention terrain offline-first `SolidarityOfflineSyncQueue`.
- ✅ **BAC-SLD-05** : Validation de checklists de mission terrain `SolidarityMissionChecklistManager`.
- ✅ **BAC-SLD-06** : Générateur de rapports aux normes UN OCHA / HDX `OchaReportGenerator`.
- ✅ **BAC-SLD-07** : Connecteur et export de données au format HXL (Humanitarian Exchange Language).

### beam (Messagerie & Communications)
- ✅ **BAC-BEM-01** : Chiffrement E2E ECDH secp256k1 + AES-256-GCM (`BeamE2EEncryptionEngine`).
- ✅ **BAC-BEM-02** : Routeur de notifications push FCM/APNs par topic conversationnel `BeamPushDispatcher`.
- ✅ **BAC-BEM-03** : Gestionnaire de messages enrichis (réponses, réactions, édition) `BeamRichMessaging`.
- ✅ **BAC-BEM-04** : Téléversement partitionné (chunked) avec TTL d'expiration `BeamChunkedUploader`.
- ✅ **BAC-BEM-05** : Moteur de recherche plein texte indexé `BeamMessageSearchEngine`.
- ✅ **BAC-BEM-06** : Purge de rétention et export conforme RGPD `BeamDataRetentionManager`.
- ✅ **BAC-BEM-07** : Routeur de bots et commandes slash `/action` `BeamBotRouter`.

### spaces (Multi-tenant & Organisations)
- ✅ **BAC-SPC-01** : Machine d'états pour domaine personnalisé DNS et SSL `SpaceCustomDomainEngine`.
- ✅ **BAC-SPC-02** : Matrice de permissions fines par rôle et contexte `actingAs`.
- ✅ **BAC-SPC-03** : Suivi de consommation métrique `SpaceUsageTracker`.
- ✅ **BAC-SPC-04** : Registre de gabarits d'espaces versionnés `SpaceTemplateRegistry`.
- ✅ **BAC-SPC-05** : Analyse de rétention par cohorte mensuelle `SpaceAnalyticsEngine`.
- ✅ **BAC-SPC-06** : Gestionnaire de synchronisation SCIM 2.0 et SSO SAML `ScimEnterpriseManager`, `SamlSsoConfigManager`.
- ✅ **BAC-SPC-07** : Journalisation d'audit des actions d'administration `SpaceAuditLogger`.

### imperia (Gouvernance & Sécurité Plateforme)
- ✅ **BAC-IMP-01** : Évaluateur déclaratif de règles de gouvernance OPA/Rego `RegoPolicyEvaluator`.
- ✅ **BAC-IMP-02** : Mappage des référentiels de conformité SOC 2, ISO 27001, RGPD, HIPAA.
- ✅ **BAC-IMP-03** : Détecteur d'écart GitOps (état désiré vs état runtime) `GitOpsDriftDetector`.
- ✅ **BAC-IMP-04** : Workflow de gestion des changements `ChangeRequestWorkflow`.
- ✅ **BAC-IMP-05** : Audit des accès et suivi de rotation des secrets.
- ✅ **BAC-IMP-06** : Quotas de budgets mensuels et alertes préventives `CostGovernanceQuotaManager`.
- ✅ **BAC-IMP-07** : Registre des runbooks d'incidents et post-mortems blameless `IncidentRunbookRegistry`.

### subscription (Abonnements & Forfaits)
- ✅ **BAC-SUB-01** : Agrégateur de consommation horaire `HourlyMeteringAggregator`.
- ✅ **BAC-SUB-02** : Calculateur de prorata intra-cycle `ProrationCalculator`.
- ✅ **BAC-SUB-03** : Calendrier de relance automatisé de dunning `DunningScheduleManager`.
- ✅ **BAC-SUB-04** : Gestionnaire des périodes d'essai gratuites sans CB `SubscriptionTrialManager`.
- ✅ **BAC-SUB-05** : Application de coupons et codes promotionnels.
- ✅ **BAC-SUB-06** : Moteur de reconnaissance des revenus (MRR, ARR, Churn) `RevenueRecognitionEngine`.
- ✅ **BAC-SUB-07** : Événements webhook de cycle de vie d'abonnement.

### Transversal
- ✅ **BAC-TRV-01** : Générateur de spécifications OpenAPI v3.1 par BAC (`OpenApiContractGenerator`).
- ✅ **BAC-TRV-02** : Suites de tests unitaires et d'intégration validées sur tous les modules.
- ✅ **BAC-TRV-03** : Télémétrie OTLP et métriques Prometheus intégrées.
- ✅ **BAC-TRV-04** : Schémas et migrations de base de données adaptatifs.
- ✅ **BAC-TRV-05** : Registre centralisé des feature flags.
- ✅ **BAC-TRV-06** : Architecture Decision Records (ADR) et documentation technique à jour.
