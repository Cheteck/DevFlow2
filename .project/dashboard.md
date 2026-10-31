# MosaiX Dashboard
**Dernière mise à jour :** 2026-10-31 — Nettoyage complet `.project` : 98 fichiers archivés (rapports obsolètes, sessions pré-2026-10-31, audits anciens, artefacts build). `PROJECT_OVERVIEW.md` créé comme source canonique d'état courant. Tests : 1157/1157 passants / 199 suites.
**Statut Global :** 🟡 Production Blockers identifiés — 9 risques P0 (R06..R08) documentés dans `PRODUCTION_AUDIT.md` et `PRODUCTION_ROADMAP.md` ; remédiation active.


---

## 1. Métriques Clés (2026-10-31)

- **Bounded Application Components (BACs) :** 10 canoniques + 3 horizon + 5 campus/sports
- **Tests :** 1157/1157 passants / 199 suites
- **Contrats de Contributions UI :** 26 enregistrés et isolés
- **Validation Manifestes & Graphe Topologique :** 10/10 validés
- **Thèmes Validés :** 2 (`midnight-ocean`, `mosaix-default`)
- **Audit de Sécurité :** 8/8 vulnérabilités résolues (SEC-01)
- **Compilation & Linters :** 0 erreur, 0 warning (non vérifié cette session)
- **Production Blockers (P0) :** 9 ouverts (voir `PRODUCTION_ROADMAP.md`)

---

## 2. Synthèse des Livraisons Rôles & Modèles (2026-09-24 / 2026-09-25)

- ✅ **SEC-01 Remédiation Complète de Sécurité (Audit 25/09)** :
  - VULN-01 : Rôle par défaut non authentifié rétrogradé à `member` ; `/api/user/switch` verrouillé en production.
  - VULN-02 : Protection BOLA/IDOR sur `/api/user/gdpr-anonymize` (seul l'utilisateur courant ou un admin conformité peut anonymiser).
  - VULN-03 : Suppression du contournement par usurpation d'en-tête `X-Mosaix-Role` sur `/api/maintenance`.
  - VULN-04 : Signature cryptographique obligatoire pour les webhooks PSP (`/api/psp/webhook`).
  - VULN-05 : Codes d'autorisation PKCE à haute entropie (256 bits via `crypto.randomBytes`) et bannissement strict de la méthode `plain` (S256 obligatoire).
  - VULN-06 : Protection anti-spoofing d'IP sur le Rate Limiter de la Gateway (`trustProxy` paramétrable).
  - VULN-07 : Protection anti-DoS par parsing de flux de requêtes HTTP borné (`safe-body-parser`).
  - VULN-08 : Exécution de `SecurityGuard.enforceProductionConstraints()` au démarrage serveur et Path Traversal Guard sur `/public/`.
- ✅ **ROLE-P1-01 `PermissionRegistry` (`@mosaix/core`)** : Support de `registerPermission({ key, description, scopes, assignableBy })`, `isRegistered`, `getRegistered`, et validation stricte des permissions atomiques.
- ✅ **ROLE-P1-02 `EffectivePermissionResolver` (`@mosaix/core`)** : Moteur de résolution avec règle prioritaire `DENY > ALLOW`, contextes de snapshot `UserAuthorizationContext`, horodatage et versioning `authorizationVersion`.
- ✅ **ROLE-P2..P7 RBAC, Dynamique & Audit** : Migrations Postgres pour `permissions`, `roles`, `role_permissions`, `global_user_roles`, `space_members`, `permission_overrides`, `acting_as_audit_events` et `role_audit_events`.
- ✅ **DATA-08 Typer les `Record<string,unknown>`** : Implémentation des schémas Zod stricts (`VendableCharacteristicsSchema`, `MediaItemMetadataSchema`, `CommerceOfferMetadataSchema`, `PostMetadataSchema`, `AuditLogMetadataSchema`) dans `@packages/schemas`.
- ✅ **CIB-01 Paiements SATIM CIB & Wallet Escrow** : Implémentation de `SatimPaymentPort` (SATIM CIB/Edahabia) et `WalletEscrowManager` avec gestion d'escrow, recharge et calcul de commissions platform.
- ✅ **SHELL-01 BAC par défaut & Orchestration Découplée** : Mise en place de `PlatformSettings` / `PlatformSettingsService` (résolution 3-tiers DB/Env/Code), contrat `BacDescriptor` unifié, et moteur `BacOrchestrator` dans le Shell. Montage autonome du BAC par défaut sans dépendance statique envers Solara.
- ✅ **PRD-0010 Proposals v1.3 simplifiée** : `portfolio_proposals` 1 table mutable (contenu courant écrasé, `platform_feedback`, `vendable_id NULL→V987`) + `ProposalService` 7 méthodes `createDraft→approve` (`356422d`, 197L) — sans `proposal_revisions`, audit externe.
- ✅ **PRD-0011 Portfolio complet** : PRD `PRD-0011-portfolio.md` v1.0 + §10 MeshJS `G:\MeshJS-by-Jules\apps\catalog` (`CatalogEngine` 12 repos, `CategoryEngine.getParentChain`, `StickerEngine` 4 conditions) + `themeContract` 10 BACs (`2395e23`).
- ✅ **Commerce source unique offre/prix + disponibilité (cf. `apps/commerce/responsibilities.md`)** : `portfolio_variants` abstrait sans `price/stock` (`FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61`), `CommerceOffer` `priceInCents/commissionRateBps/stockAllocation` + `Money` VO seule vérité (`commerce:offer:create`) ; `stockAllocation` = référence d'allocation derrière `InventoryPort` (extraction `@apps/inventory` si justifié), jamais propriété du vendable.
- ✅ **Paiements COD Algérie + Wallet** : `commerce_payment_intents` `cod_pending→cod_delivered→succeeded` par défaut, `CheckoutOrderWorkflow` `AuthorizePayment` no-op pour COD, wallet escrow `wallets/wallet_transactions` prévu moyen terme (`escrow_hold→release`).
- ✅ **BAC Livraison** : extraction `delivery-partner.service.ts` → `@apps/delivery` `delivery_methods(cod|express|pickup) + delivery_boys + deliveries + assignments` (`out_for_delivery→delivered` + `proofUrl` + `codAmountInCents`).

## 3. Statut du Backlog Actif (2026-10-31)

- **Pilotage :** `.project/backlog/BACKLOG.md` (registre : 5 P0 · 6 P1 · 9 P2) + `.project/backlog/RELEASE-READINESS.md` (gate prod) + `.project/backlog/INMEMORY_REMEDIATION.md` (audit vérifié 2026-10-31)
- **Production Roadmap :** `.project/PRODUCTION_ROADMAP.md` (Phase 1: 9 P0 tasks R06→R08)
- **Production Audit :** `.project/PRODUCTION_AUDIT.md` (dernier audit 2026-10-31)
- **Legacy gelé :** `.project/backlog/active-backlog.md` → snapshot `.project/archive/active-backlog-2026-10-09-legacy.md`
- **Archives :** `.project/_archive_review/` (98 fichiers archivés pour revue avant suppression définitive)


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
- 🚀 **Phase 25 (BAC Domain Evolution & Hardening)** : Évolution et durcissement livrés sur les 10 BACs (Scrypt/lockout & RGPD Citadelle, State Machine & PaymentIntent & Offres Agnostiques multi-entités Commerce, Recherche à facettes & variantes descriptives Portfolio (PIM pur, sans prix ni stock), Pipeline modération 3-tiers & parseur tags Solara, iCalendar RFC 5545 & Waitlist Booking, Matching géospatial & Merkle audit trail Solidarity, E2E Crypto ECDH/AES-GCM & bots Beam, Custom domain DNS/SSL & usage tracker Spaces, Compliance SOC2/HIPAA/GDPR & GitOps drift detector Imperia, Prorata & décisions `past_due` Subscription (dunning/notifications→externes)).
- ✅ **BAC-COM-07 - Offres Agnostiques de Vendables** : Le Bounded Application Component `commerce` prend désormais en charge les offres (`CommerceOffer`) de manière totalement agnostique pour toute entité vendeuse (`SellerEntityRef` : `space`, `tenant`, `user`, `collective`, etc.) avec cycle de vie d'offre, allocation de stock, calcul de commission et routage de paiement.
- 🛡️ **Phase 26 - Infrastructure, RLS Natif & Sécurité Avancée** : Schémas PostgreSQL canoniques par BAC (`PostgresBacSchemaMigrator`), Row Level Security natif (`PostgresRlsManager`), `SchemaBuilder.inSchema()`, hasher Bcrypt / Argon2 (`Citadelle`), Saga de réservation et compensation via `InventoryPort` (`Commerce`), import CSV avec validation (`Portfolio`), portail prestataire SSR (`Booking`), antivirus et legal hold (`Beam`), domaine personnalisé avec HSTS/ACME Let's Encrypt et SCIM (`Spaces`), règles de gouvernance déclaratives Rego (`Imperia`), metering Redis sorted sets (`Subscription`, montants dus uniquement) et projections MRR/ARR côté analytics (jamais source de vérité Subscription), ADR-0014 et diagrammes d'architecture C4.
- 🧩 **Phase 27 - Plugin Engine Optimal (Priorités 1 à 8)** :
  1. `HookExecutionEngine` (`runHook(point, args)` en waterfall/parallel/bail, priorités, timeout).
  2. `WorkspacePluginLoader` (scan `plugins/**/mosaix.json`, watch, hot reload/unload).
  3. `PluginSandboxEnvironment` (isolation Realm/VM, timeout threshold et containment global).
  4. `PluginCapabilityResolver` (résolution `requiresCapabilities` au register, injection de ports réels).
  5. `PluginSettingsValidator` & `PluginSettingsManager` (validation JSON Schema, types, defaults, réactivité `onChange`).
  6. `PluginEventBus` (bus d'événements `plugin:event` inter-plugins avec wildcard patterns et isolation).
  7. `PluginCliCommandRunner` (`mosaix plugin install|update|remove|list|dev`).
  8. `PluginMarketplaceRegistry` (index distant, résolution semver `^1.0.0`, vérification d'intégrité SHA-256 et signature cryptographique HMAC/RSA).

---

## 5. Nettoyage Documentation (2026-10-31)

### Fichiers Archivés (98 total)
| Catégorie | Nb | Détails |
|---|---|---|
| Rapports de session (2026-09-24 → 2026-11-06) | 40 | `session-*.md` pré-2026-10-31 |
| Audits techniques obsolètes | 18 | `audit-*.md`, `mcp-*.md`, `security-*.md`, `frontend-audit-*.md`, `db-bypass-*.md`, `remediation-plan-*.md`, `repository-health-*.md` |
| Plans pré-production dépassés | 6 | `STATE.md`, `PRE-PRODUCTION-AUDIT-PLAN*.md`, `WORKFLOW-PRE-PRODUCTION-AUDIT.md`, `project_state.md`, `roadmap-auth.md`, `PLATFORM-GRANDES-LIGNES.md` |
| Rapports DEV-SERVER (travail parallèle, pas nous) | 5 | `DEV-SERVER-*.md` |
| Fichiers de travail temporaires | 11 | `commit-msg-*.txt`, `vitest-*.txt` |
| Artefacts build racine | 7 | `.tsc-*.txt`, `.tsc-verify*.txt`, `prompt.txt` |
| Audit applicatif (supplanté par PRODUCTION_AUDIT.md) | 1 | `audit-applicatif-mosaix-2026.md` |

### Nouvelles Créations
- **`PROJECT_OVERVIEW.md`** — Source canonique d'état courant (vérifiée contre le code)
- **`_archive_review/`** — Zone de rétention avant suppression définitive

### Corrections
- `BACKLOG.md` : doublon `VIEW-E2E-A` supprimé (lignes 16-17)

### Rollback
```bash
git reset --hard d0c24d9  # avant commit "chore: remove root build artifacts"
```
