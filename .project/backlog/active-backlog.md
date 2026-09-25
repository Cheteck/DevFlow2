# MosaiX / IJIDeals Platform — Active Backlog

- **Dernière mise à jour :** 2026-09-24 — CIB + Gestion-Commerciale (Next-base `eb156d00`/`85a7ec11`) + PRD-0011 MeshJS
- **Statut global :** FEAT-01..13 archivés — 19 tâches : 12 livrées (ROLE, DATA-01/09, PRD-0010) / 7 restantes (DATA-07/08 + THEME UI + PRD-0011 19 pages + CIB-01 + GEST-01 + WALLET/DELIVERY) — voir §6-§8. Historique dans `.project/archive/completed-backlog-history.md`.

---

## 1. Synthèse de l'État du Backlog

Toutes les phases de la feuille de route et les enrichissements demandés pour les 10 BACs (Phase 25) ont été livrés avec succès, compilés (`compile_applet`) et vérifiés (`lint_applet` sans aucune erreur) :

| Bounded Context / Périmètre | Actions Implémentées | Statut |
|---|---|---|
| **citadelle** (Identité & IAM) | BAC-CIT-01 à BAC-CIT-06 (Scrypt hasher, lockout guard, session rotation, OAuth providers, event sourcing, RGPD) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **commerce** (Commandes & Checkout) | BAC-COM-01 à BAC-COM-07 (Modèle enrichi, state machine, payment intent, stock reservation, saga, offres agnostiques multi-vendeurs) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **portfolio** (Catalogue & Vendables) | BAC-POR-01 à BAC-POR-06 (Pricing variants, inventory, SEO, workflow, recherche à facettes, bulk import/export CSV/JSON, média CDN) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **solara** (Social & Pulse) | BAC-SOL-01 à BAC-SOL-07 (Modération 3-tiers, scoring flux, tags/mentions, rich media OpenGraph, groupes, realtime notifier, analytics) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **booking** (Réservations & Créneaux) | BAC-BKG-01 à BAC-BKG-07 (iCalendar RFC 5545, empreinte bancaire, rappels T-24/T-1, portail stats, waitlist FIFO, multi-ressources, analytics) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **solidarity** (Humanitaire & Crises) | BAC-SLD-01 à BAC-SLD-07 (PostGIS/GeoJSON, matching géospatial Haversine, arbre de Merkle, offline sync queue, checklists, rapports OCHA/HXL) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **beam** (Messagerie & Communications) | BAC-BEM-01 à BAC-BEM-07 (Chiffrement E2E ECDH/AES-GCM, push FCM/APNs, rich messages, chunked upload, recherche, purge RGPD, bot commands) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **spaces** (Multi-tenant & Organisations) | BAC-SPC-01 à BAC-SPC-07 (Domaines DNS/SSL, RBAC actingAs, facturation à l'usage, templates, analytics cohortes, SSO SAML & SCIM 2.0, audit) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **imperia** (Gouvernance Plateforme) | BAC-IMP-01 à BAC-IMP-07 (Règles OPA/Rego, conformité SOC2/ISO/GDPR, GitOps drift detection, change management, secrets Vault, quotas budgets, runbooks) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **subscription** (Abonnements & Forfaits) | BAC-SUB-01 à BAC-SUB-07 (Metering horaire, prorata cycle, dunning retry, essais sans CB, coupons, comptabilité MRR/ARR, webhooks) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **Transversal** (Architecture & Qualité) | BAC-TRV-01 à BAC-TRV-06 (OpenAPI generator, tests automatisés, observabilité OTLP/Prometheus, migrations DB, feature flags, ADR) | ✅ COMPLÉTÉ & ARCHIVÉ |

---

## 2. Historique & Archives
L'historique complet et détaillé des implémentations antérieures (Phases 1 à 24, dogfooding BL-010 à BL-023, décisions interactives) est disponible dans :
👉 `/.project/archive/completed-backlog-history.md`

---

## 3. Vérification du 2026-09-24 — Élagage des tâches déjà implémentées

Vérification code-vs-backlog effectuée le 2026-09-24 (analyse `apps/*/src/domain`, `infrastructure/migrations.ts`, `postgres-*-repository.ts`, `packages/core/src/permission.ts`, `packages/migrations/src/grammar.ts`) :

| FEAT | Fichiers présents | Verdict |
|---|---|---|
| FEAT-01 maintenance `imperia/maintenance.service.ts:12` | oui | ✅ conservé archivé — bypass `platform-admin/imperia/admin` + `platform:admin` `imperia:admin` opérationnel |
| FEAT-02 inscription multi-étapes `citadelle/registration-wizard.service.ts:174` | oui | ✅ archivé |
| FEAT-03 produit multi-étapes `portfolio/product-wizard.service.ts` | oui | ✅ archivé |
| FEAT-04 enchères `commerce/auction.service.ts:71` (320L, ECDH non, anti-sniping, auditHash SHA256) | oui | ⚠️ **partiel** — service `Map` mémoire `auction.service.ts:72`, aucune table `commerce_auctions/bids` → persistance manquante, reclassé en DATA-03 |
| FEAT-05 comptes livraison `commerce/delivery-partner.service.ts:132` | oui | ✅ archivé (vérif `verifiedBy adminUserId`) |
| FEAT-06 rapports boutiques `portfolio/shop-analytics.service.ts` + `shop-inventory-report.service.ts` | oui | ✅ archivé |
| FEAT-07 intérêt rupture `portfolio` telemetry | oui | ✅ archivé |
| FEAT-08 partage auto `solara/social-auto-share-plugin.ts` | oui | ✅ archivé |
| FEAT-09 compteur visites `portfolio` telemetry | oui | ✅ archivé |
| FEAT-10 registre commerce `spaces/business-registry.service.ts:109` (`verifySpace/rejectSpace/revokeVerification`) | oui | ✅ archivé |
| FEAT-11 analyse catégories `imperia/category-analysis.service.ts` | oui | ✅ archivé |
| FEAT-12 sidebar aide `ui-runtime` | oui | ✅ archivé |
| FEAT-13 QR Codes `transversal` | oui | ✅ archivé |
| BAC-CIT-01..06, BAC-COM-01..07, etc. | oui | ✅ archivés — services domaine présents, mais **persistance incomplète** (voir §5-6) |

**Action d'élagage** : FEAT-01..13 et BAC-TRV restent archivés dans `completed-backlog-history.md`. Seuls les **gaps de persistance & rôles** ci-dessous restent actifs. Doublons éliminés : `VariantModel` vs `VariantItem`, `VendableModel` vs `Vendable` (unifier en §6).

## 4. Prochaines Étapes Opérationnelles (Roadmap Horizon Futurs)
Les actions suivantes représentent des chantiers d'infrastructure, d'industrialisation et d'extension sectorielle en environnement de production réel :

### A. Infrastructure & Production
- **INFRA-01** : Déploiement en cluster Kubernetes multi-régions avec connectivité managée Kafka et RabbitMQ live.
- **INFRA-02** : Provisionnement des comptes de production partenaires (Stripe Connect live, APNs / FCM production credentials, instances Vault dédiées).

### B. Extension Verticale : Écosystème Sports & Athlétisme (ex: CAJ Jijel)
- **BAC-OLYMPIA (`@apps/olympia`) — Performance & Passeport Athlète** : Passeport médical, carnet de performance, records personnels (*PB/SB*), suivi des charges d'entraînement (VMA, récupération) et certificats médicaux.
- **BAC-CHRONOS (`@apps/chronos`) — Chronométrage Live & Dossards** : Attribution atomique des dossards, puces RFID, checkpoints de course (km 2.5/5/7.5/arrivée) et leaderboards en direct.
- **BAC-PATRONUS (`@apps/patronus`) — Sponsoring, Crowdfunding & Subventions** : Contrats de sponsoring, financement participatif pour déplacements et génération automatique des dossiers de subvention (DJS / Wilaya).
- **BAC-ARENA (`@apps/arena`) — Infrastructures & Matériel** : Gestion des installations (stades, pistes, gymnases), réservations de terrains et prêts de matériel (témoins, haies, chrono).
- **BAC-CURATOR (`@apps/curator`) — Héritage & Armoire à Trophées** : Musée digital du club, Hall of Fame des champions et archives historiques.

### C. Extension Verticale : Écosystème Études, Campus & Emploi
- **BAC-ACADEMY (`@apps/academy`) — LMS, Scolarité & Diplômes** : Cours & modules, devoirs horodatés, relevés de notes ECTS et émission de diplômes/certificats numériques certifiés.
- **BAC-CAREER (`@apps/career`) — Job Board & Recrutement (ATS)** : Offres de stages/PFE/emplois, candidatures en 1-clic (*Easy Apply*), analyse des écarts de compétences (*Skill Gap Analysis*) et CVthèque recruteurs.
- **BAC-MENTOR (`@apps/mentor`) — Réseau Alumni & Tutorat** : Annuaire des anciens élèves (Alumni), parrainage professionnel, tutorat entre étudiants et bilans d'orientation.
- **Fonctionnalités Communautaires & Sociales (Inspiration Facebook & LinkedIn)** :
  - *Sceau Diplôme Vérifié* & validation de compétences (*Endorsements*) par les professeurs sur profil Citadelle.
  - *Groupes de Promo, TD & Clubs étudiants* sur Spaces/Solara.
  - *Marketplace Étudiante* (livres, manuels, colocations) sur Commerce/Portfolio.
  - *Événements Campus & Billetterie QR Code* (hackathons, remise de diplômes) sur Booking/Solara.

---

## 4bis. Fonctionnalités & Améliorations — Archive (entrée 2026-09-24, conservée pour traçabilité)

Règle plugin vs cœur (modèle `plugin-engine` tiers ui/application/privileged ; plugins existants = légers, optionnels, jamais sur chemin critique) :
- **CŒUR** = argent, identité, sécurité, gouvernance, invariants, RBAC, persistance per-app.
- **PLUGIN** = optionnel par boutique, sans état critique, event-driven, enrichit l'UI.

### 🔴 Urgent
- **FEAT-01 Mode maintenance** [CŒUR] (imperia + shell) : toggle admin, page maintenance pour les autres, bypass seuls rôles platform-admin/imperia, APIs en 503 sauf admin. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-02 Inscription multi-étapes** [CŒUR] (citadelle + ui-runtime) : wizard step-by-step, progression, validation/sauvegarde par étape. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-03 Ajout produit multi-étapes** [CŒUR] (portfolio + ui-runtime) : wizard vendable create, progression, draft persistant. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-04 Enchères** [CŒUR + plugins périphériques] (commerce + portfolio + beam) : anglaise avec prix de réserve + extension anti-sniping + paiement via commerce ; moteur cœur `commerce.auction.*` (prix départ, offres, durée, clôture, historique opposable) ; badges/notifications/auto-bid en plugins `application`. Statut: ✅ COMPLÉTÉ & TESTÉ.

### 🟠 Priorité élevée
- **FEAT-05 Comptes sociétés de livraison** [CŒUR] (citadelle + commerce + spaces) : inscription puis validation admin, assignation manuelle par le vendeur, profil entreprise, gestion livraisons, suivi statuts, dashboard dédié. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-06 Rapports boutiques** [CŒUR + plugin rendu] (portfolio + commerce) : moteur données cœur (rares, bientôt en rupture, rupture, réappro) ; envoi hebdomadaire email + consultation dashboard ; formatage/envoi en plugin `application` (grants `portfolio:read`). Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-07 Intérêt produits en rupture** [CŒUR] (portfolio + telemetry) : comptage visites indisponibles, consultations malgré rupture, rapport demande. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-08 Partage auto réseaux sociaux** [PLUGIN `application`] (solara + portfolio) : écoute `portfolio.vendable.published`, contenu auto-généré en brouillon, le vendeur choisit les réseaux et valide avant envoi, configurable par boutique. Statut: ✅ COMPLÉTÉ & TESTÉ.

### 🟡 Moyenne
- **FEAT-09 Compteur de visites** [CŒUR + plugin affichage] (portfolio + telemetry) : session anonymisée RGPD sans IP brute, exclusion bots, uniques vs totales par période ; comptage fiable cœur ; widget stats boutique en plugin `ui`/`application`. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-10 Registre de commerce** [CŒUR] (spaces + citadelle/imperia) : documents de vérification associés au **space** pro (pas à l'utilisateur), dépôt puis validation admin, statuts pending/verified/rejected, badge « vérifié » affiché sur la boutique, révocable, consultation/gestion admin. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-11 Analyse catégories** [CŒUR] (imperia + spaces/portfolio) : catégories avec peu de boutiques, stats sous-représentation, dashboard admin. Statut: ✅ COMPLÉTÉ & TESTÉ.
- **FEAT-12 Sidebar aide formulaires** [PLUGIN `ui`] (transversal ui-runtime) : contextuelle par étape, conseils, obligatoires/erreurs fréquentes. Statut: ✅ COMPLÉTÉ & TESTÉ.

### 🟢 Complémentaire
- **FEAT-13 QR Codes** [PLUGIN `ui`] (transversal + portfolio/spaces) : QR statiques vers URL page/produit/boutique, téléchargement PNG/SVG, sans tracking. Statut: ✅ COMPLÉTÉ & TESTÉ.

### Synthèse plugin vs cœur
- **Plugins idéaux** : FEAT-08, FEAT-12, FEAT-13 (+ volets affichage FEAT-09, rendu FEAT-06, périphérie FEAT-04).
- **Cœur obligatoire** : FEAT-01, 02, 03, 04 (moteur), 05, 06 (moteur), 07, 09 (comptage), 10, 11.

---

## 5. Moteur d'autorisation unique — Rôles dynamiques en production (Refonte 2026-09-24)

> **Principe** : les rôles sont des **données administrables** ; les permissions et le moteur restent **contrôlés par le code**. L'app n'interroge jamais les rôles :
> ```ts
> authorization.can(userId, "commerce:order:create:space", { spaceId })
> // ou
> authorization.authorize("commerce:order:create:space", { spaceId, organizationId }, userId)
> ```
> Le moteur résout `can` à partir du registre, pas l'inverse. Ref fondatrice : ton retour §1-14.

**Modèle cible — contrat figé dès P1** (ajustements 1-3 du retour)
```
EffectivePermissions(user, space) =
  GlobalPermissions(user) ∪ SpacePermissions(user, space) ∪ ExplicitOverrides(user, space)
  effectif = ALLOW - DENY
  règle : DENY explicite > ALLOW explicite, indépendamment de la provenance
           global DENY + space ALLOW → DENY
           global ALLOW + space DENY → DENY
           absence de permission ≠ DENY (ALLOW global + aucune règle Space = ALLOW)
  matcher : if anyMatchingDeny(permission) → DENY; else if anyMatchingAllow → ALLOW; else DENY
            (DENY gagne toujours, même wildcard DENY vs exact ALLOW : ALLOW commerce:order:refund:space + DENY commerce:order:* → DENY)
```
Parser `permission: "commerce:order:create:space"` → `{domain:"commerce",resource:"order",action:"create",scope:"space"}` (`packages/types/src/index.ts:46` `parsePermission`, `packages/core/src/permission.ts:13` `matchSegments`). Le resolver collecte tous les matches puis applique `DENY > ALLOW` à spécificité équivalente — complexité dans `match`, pas dans la priorité.

**Snapshot + versioning (sécurité, pas optimisation) — exigence P1** : `UserAuthorizationContext = await authorization.loadContext(userId, {spaceId, organizationId})` charge une fois ; `context.can(perm)` résout en mémoire. Chaque snapshot porte `{userId, spaceId, authorizationVersion, generatedAt, allows, denies}`. À chaque `can()` : `version actuelle === version snapshot ? utiliser : recalculer`. Invalidation par `Role changed / permission changed / membership changed / override changed / role assigned|revoked → authorization_version++` (version par Space `space.authorization_version` + par utilisateur `user.authorization_version`). Évite fenêtre `10:01 permission sensible accordée → 10:02 révoquée → 10:04 cache encore valide → usage indu`.

**Schéma cible (unifié, pas JSONB comme source de vérité)**
```sql
permissions(key PK, description, scope, assignableBy JSONB, metadata JSONB)
roles(id PK, key, name, scopeType GLOBAL|SPACE, scopeId nullable, rank int, isSystem bool, inheritsFrom FK, createdBy, createdAt, updatedAt)
role_permissions(roleId FK, permissionKey FK → permissions.key, effect ALLOW|DENY, PK(roleId,permissionKey))
global_user_roles(userId FK, roleId FK, grantedBy, grantedAt, expiresAt, PK(userId,roleId))
space_members(spaceId FK, userId FK, roleId FK → roles.id, createdAt, updatedAt, PK(spaceId,userId))
permission_overrides(userId, spaceId nullable, permissionKey FK, effect ALLOW|DENY, expiresAt, grantedBy, PK(userId,spaceId,permissionKey))
acting_as_audit_events(id PK, actorUserId, targetUserId, spaceId, action, metadata JSONB, permissionsUsed JSONB, ip, createdAt)
```
Remplace `allowedCapabilities JSONB` comme source vérité → `role_permissions`; `permissionsOverride JSONB` → `permission_overrides`.

### Phase 1 — Permission Engine (fondation, garde-fou) — **doit figer P1 : règles DENY/ALLOW/wildcard + versioning + contrat PermissionRegistry**

- **ROLE-P1-01 PermissionRegistry + parser/matcher** — Registre déclaratif des permissions atomiques stables (`commerce:order:create:space`, `imperia:governance:manage:platform`, `identity:impersonate:space`...), `registerPermission({key, description, scopes:["space"], assignableBy:["owner","admin"]})`, validation à la création de rôle (refuse `database:drop:production` si non registré). Parser/matcher `permission.ts:13` : `match(permission)` définit ce qui match (wildcard `*` sur `domain|resource|action` uniquement, `scope` jamais wildcard `permission.ts:28`). Fichiers : `packages/core/src/permission.ts` (étendre `assertRegistered`), `packages/schemas/src/index.ts` (zod `PermissionSchema`). Critères : `createSpaceRole` avec permission inconnue → 400. Tests : registre ~40 clés. **Aucune UI ni nouveau rôle métier nécessaire pour valider P1.**
- **ROLE-P1-02 EffectivePermissionResolver + AuthorizationContext + contrat décision** — `packages/core/src/effective-permission-resolver.ts` strict avec contrat figé dès P1 :
  ```ts
  type PermissionEffect = "ALLOW" | "DENY";
  type PermissionDecision = { allowed: boolean; matchedPermission: string | null; effect: PermissionEffect | null; source: PermissionSource | null };
  // source = {role:"space:editor", spaceId:"abc123"} ou {override:"user:123"}
  // Règle : if anyMatchingDeny(permission) → DENY; else if anyMatchingAllow → ALLOW; else DENY
  ```
  `resolve({userId, spaceId, organizationId}) → {allows:Set, denies:Set, source:Map<Permission, {effect, role, scopeId}>}` avec `source` debuggable + `denies` conserve **la règle qui a provoqué le deny** (pas seulement Set final). `authorization.can(userId, perm, ctx)` / `authorize(perm, ctx, userId)` uniques, `loadContext(userId, ctx) → UserAuthorizationContext{userId, spaceId, authorizationVersion, generatedAt, allows, denies}` + `can()` mémoire. Versioning `space.authorization_version` + `user.authorization_version`, `version++` sur `role/permission/membership/override` changed → `loadContext` compare version et recalcule si stale. Conserve adaptateurs legacy (`requireAdmin`, `isUserAdmin`) derrière le resolver. Critères : `can("commerce:order:create:space",{spaceId})` ignore origine mais trace `source` ; `global DENY + space ALLOW → DENY` testé. Tests priorité : matrice §14 (wildcard `commerce:order:*` ALLOW + exact `commerce:order:refund:space` DENY → DENY).

### Phase 2 — Global RBAC (migration)

- **ROLE-P2-01 Tables globales + migration** — `permissions`, `roles(scopeType=GLOBAL)`, `role_permissions`, `global_user_roles` (SQL ci-dessus). Migrer `citadelle_identities.roles string[]` `citadelle/user.model.ts:6` (défaut `["citizen"]`) + vocabulaires éclatés (`admin/platform-governor/platform-admin/super-admin/imperia` `imperia-controller.ts:65` + `maintenance.service.ts:24`) → enum `superadmin|admin|moderator|support|citizen` hiérarchie `superadmin(100)>admin(80)>moderator(60)>support(40)>citizen(10)` (rank = qui gère qui, pas autorisation). Seed `superadmin:["*"]`, `moderator:["solara:post:moderate:tenant"]`. Remplacer `requireAdmin()` par `authorize("imperia:governance:manage:platform", {organizationId:"platform"}, userId)` et `maintenance bypass` par `platform:maintenance:bypass:platform`. Critères : ancien `roles.includes("admin")` supprimé, tous les checks passent par `can`.

### Phase 3 — Space RBAC (migration) — **avec date de suppression legacy**

- **ROLE-P3-01 Tables Space + migration team JSONB** — `roles(scopeType=SPACE, scopeId=spaceId)`, `role_permissions`, `space_members` (ci-dessus). Migrer `spaces_spaces.team JSONB` + `space_members` orpheline `migrations/20260922162100:15` + `SpaceRolePolicyEngine` Map `space-roles.ts:12` (`owner:["*"]` etc.) → DB. Seed par space : `owner(100):["*"]`, `admin(80):["spaces.*","commerce.*"]`, `editor(60):["portfolio:vendable:*:space"]`, `moderator(40)`, `analyst(20)` + `custom` créables. `SpaceService.addTeamMember()` `space.model.ts:166` → `INSERT ... ON CONFLICT (space_id,user_id) DO UPDATE`. **Compat temporaire `team JSONB` lecture seule avec deadline** : `legacy → nouveau modèle` en P3, suppression lecture legacy en fin de P3 (ne pas laisser deux sources de vérité actives indéfiniment). Critères : `SpaceRolePolicyEngine` lit DB, plus de `Map`.

### Phase 4 — Rôles dynamiques (sans migration SQL)

- **ROLE-P4-01 CRUD applicatif transactionnel** — API minimale :
  ```
  POST   /spaces/:spaceId/roles
  PATCH  /spaces/:spaceId/roles/:roleId
  DELETE /spaces/:spaceId/roles/:roleId
  POST   /spaces/:spaceId/members/:userId/roles
  DELETE /spaces/:spaceId/members/:userId/roles
  ```
  Chaque mutation : `Authorization → RoleGovernancePolicy → PermissionRegistry → transaction DB → authorization invalidation` (client ne peut jamais écrire directement `role_permissions`). `roleService.createSpaceRole({spaceId,key:"order-manager",name, permissions:["commerce:order:read:space"...], actorId})`, `updateRole`, `deleteRole`, `assignRole`, `revokeRole` transactionnels, validés contre `PermissionRegistry` (assignableBy). `Owner → créé Order Manager → sélectionne permissions → assigne à Alice` sans migration. Validation : `rank` ≠ autorisation, sert à `qui peut modifier/assigner ce rôle`. Fichiers : `apps/spaces/src/domain/space-roles.ts:29` (`createRole` devient DB), `space.model.ts`. Critères : création custom en prod sans déploiement, permission inconnue rejetée.

### Phase 5 — Overrides + héritage DAG (séparés)

- **ROLE-P5-A Permission overrides** — `permission_overrides` + `role_permissions.effect` (`ALLOW|DENY`), `effective = ALLOW - DENY`, règle figée P1 `deny > allow` absolu. Ex : `allow commerce:order:*` + `deny commerce:order:refund:space` → `create/update ✅`, `refund ❌` (DENY gagne même si ALLOW exact vs DENY wildcard : `ALLOW commerce:order:refund:space` + `DENY commerce:order:*` → DENY).
- **ROLE-P5-B Héritage DAG** — `roles.inheritsFrom` DAG validé dans la même transaction : `A→B` OK, `A→B→C` OK jusqu'à profondeur définie, `A→B→A` rejeté, pas de cross-scope (`SPACE` n'hérite pas `GLOBAL`), pas vers rôle supprimable, explosion graphe bornée. `OrderManager inherits Editor` OK. Matrice tests : `Global allow|Space deny → deny`, `wildcard allow + exact deny → deny`, `role expiré/membership supprimée → deny`, `acting-as sans permission → deny` (`§14` retour, 10 cas).

### Phase 6 — Acting-as strict + audit

- **ROLE-P6-01 Impersonation découplée** — Capacités `identity:impersonate:user|space` distinctes de `permission de faire X` + règle `acting-as permissions ⊆ actor permissions` (jamais d'élévation). Contexte conserve `{actorUserId, subjectUserId, spaceId, actingAs:true}` (jamais `currentUserId = targetUserId` remplacé). Audit `acting_as_audit_events(actorUserId, targetUserId, spaceId, action, metadata, permissionsUsed, reason, startedAt, endedAt, ip)` `acting-as-space.ts:32` étendu (vs `restricted` seul). Fichiers : `apps/spaces/src/domain/acting-as-space.ts`, `citadelle`.

### Phase 7 — RLS (barrière indépendante, après RBAC)

- **ROLE-P7-01 Isolation PostgreSQL** — RLS = barrière indépendante, pas `RBAC → génère policies` :
  ```
  Application authorization  +  Database isolation (RLS)
  ```
  Partage `spaceId` mais responsabilités distinctes. Via `PostgresBacSchemaMigrator` `postgres-bac-schema-migrator.ts:25` / `postgres-schema-grammar.ts:37` (`ENABLE RLS`, `POLICY tenant_isolation USING tenant_id=current_setting(...)`) + `SET LOCAL app.current_tenant_id/space_id` `kernel.ts:478` + `TenantIdentity` `tenant-schema-manager.ts:17`. Architecture `HTTP → Authorization → Business → Tenant/Space context → RLS`. Supprimer `database-bootstrap.ts:28` SQLite divergeant à la fin, pas en P1. Criticité infra distincte.

### Transverse — Role/Authorization Audit (ajout §14 retour)

- **ROLE-AUDIT** — Au-delà de `acting_as_audit_events`, tracer :
  ```
  role.created | role.updated | role.deleted | role.permission_added | role.permission_removed
  role.assigned | role.revoked | permission.override_created | permission.override_removed | role.inheritance_changed
  ```
  avec `{actor, target, space, before, after, timestamp, request/session metadata}`. Critique dès que rôles dynamiques en prod. Table `role_audit_events`.

**Ordre** : P1 → P2 → P3 → P4 → P5 → P6 → P7. Tests matrice `| Global | Space | Override | Résultat |` (10 cas §14 du retour, dont `global deny + space allow → deny` à documenter).

## 6. Modèles de données — Enrichissement & persistance manquante (nouveau)

Gaps issus de l'analyse `apps/*/src/domain/*.ts` vs `infrastructure/migrations.ts` vs `postgres-*-repository.ts` : `Vendable` 9 objets → 5 cols migration `portfolio/migrations/20260922162000:6` vs 13 cols repo `postgres-vendable-repository.ts:42` ; `commerce_offers/payment_intents/auctions` fantômes (`auction.service.ts:22` 320L, `commerce-offer.model.ts:13`, `commerce-payment-intent.ts:10`) ; `beam RichMessageMetadata` `beam-rich-messaging.ts:6` + `EncryptedMessagePayload` `beam-e2e-crypto.ts:3` absents de `MessageModel` `messaging.model.ts:11` ; `solidarity` 13 interfaces `models.ts:1` → 2 tables ; `solara` 3 tables manquantes ; `subscription` `INTEGER epoch ms` vs `TIMESTAMPTZ` ; `View` counts dénormalisés sans trigger ; `Record<string,unknown>` 14×.

- **DATA-01 [CŒUR] Portfolio — éclatement Vendable** — Tables `vendables(id, reference UNIQUE, type enum, status enum, createdAt, updatedAt)` + `vendable_translations(vendable_id FK, lang, name, shortDescription, description)` + `vendable_variants(id, vendable_id FK, sku UNIQUE, pricing JSONB, inventory JSONB)` (unifier `VariantModel` `persistence/vendable.model.ts:7` + `VariantItem` `vendable.ts:80`) + `vendable_relations(source_id FK, targetId, type enum)` + `media_assets(id, vendable_id FK, type, url, metadata)` + `GIN on characteristics/specifications`. Supprimer duplication `pricing/inventory` root vs variant → `variant overrides`. Col `reference` unique race-safe. Fichiers : `apps/portfolio/src/domain/vendable.ts`, `infrastructure/migrations/20260922162000_create_portfolio_tables.ts`, `postgres-vendable-repository.ts`. Criticité 🔴
- **DATA-02 [CŒUR] Commerce — matérialiser offres/paiements** — `commerce_offers(id, seller_type enum, seller_id, vendableId FK, priceInCents integer CHECK >=0, currency CHAR(3), status enum, stockAllocation, commissionRateBps, payoutDestination JSONB, metadata JSONB, createdAt)` + `commerce_payment_intents(id, orderId FK, amount, currency, status enum 8, clientSecret, amountReceived/Refunded, metadata)` + FK `commerce_orders.vendableId → vendables.id`. Migrer `grammar.ts:249` `case "decimal"` → `DECIMAL(12,2)`. Remplacer `Array.filter` `commerce-offer.model.ts:139` par `WHERE seller_type=$1 AND seller_id=$2`. Criticité 🔴
- **DATA-03 [CŒUR] Commerce — persistance enchères** — `commerce_auctions(id, vendableId FK, sellerId, sellerSpaceId, startPrice, reservePrice, minBidIncrement, currency, currentBid, highestBidderId, status enum draft|active|closed|cancelled, startTime, endTime, antiSnipingWindow/Extension, extensionsCount, reserveMet, winningBidId, settledOrderId FK)` + `commerce_auction_bids(id, auction_id FK, bidderId, bidderName, amount, timestamp, auditHash, previousHash)` chaîne SHA256 `auction.service.ts:193` vérifiable. Remplacer `Map<string,Auction>` `auction.service.ts:72` par repo Postgres + `SELECT FOR UPDATE` sur `placeBid`. Criticité 🟠
- **DATA-04 [CŒUR] Beam — enrichir messaging** — Étendre `beam_messages` `20260922161700:13` : `reply_to_message_id FK, thread_id, edited_at, deleted_at, reactions JSONB GIN, attachments JSONB, encrypted_payload JSONB (EncryptedMessagePayload)` + `beam_conversation_participants(conversation_id FK, user_id FK, PK composite, idx_user_id)` remplace `participants JSON` `messaging.model.ts:7` + `beam_message_reactions` normalisée si besoin. Index composite `(conversation_id, sentAt DESC)` pour pagination. Fichiers : `apps/beam/src/domain/messaging.model.ts`, `beam-rich-messaging.ts`, `beam-e2e-crypto.ts`. Criticité 🟠
- **DATA-05 [CŒUR] Booking/Solidarity/Solara — tables manquantes** — Booking : `booking_waitlists`, `booking_reminders` (`booking-calendar-sync.ts:87`, `booking-portal-resources.ts:3`), fix `reservations` vs `booking_reservations` `migrations.ts:34` vs `postgres-booking-repository.ts:60`, `CHECK (startTime<endTime)`, `idempotency_keys` table (remplace `idempotencyStore` Map `booking.model.ts:161`). Solidarity : `incidents, resources, hubs, missions, distributions, allocations` (5 manquantes `migrations.ts:18`). Solara : `solara_posts, solara_comments, solara_followers` (3 manquantes, seule `reactions` existe). Subscription : migrer `user_subscriptions` `INTEGER` → `TIMESTAMPTZ` `subscription.service.ts:18` via `MigrationProvider`. Criticité 🔴
- **DATA-06 [CŒUR] Normaliser valeur & temps** — Value objects `Money{amountInCents integer, currency CHAR(3) CHECK length 3}` et `Timestamp TIMESTAMPTZ` uniques : remplacer `price number` Booking, `totalAmount number` Order, `meteredUsageUnits number` Subscription, `string` vs `Date` vs `number` disparates (`space.model.ts:40 Date`, `booking.model.ts:39 string`). Linter `no-float-money`. Fichiers : `commerce-offer.model.ts:19`, `order.model.ts:46`, `booking.model.ts:45`, `subscription.ts:23`. Criticité 🟡
- **DATA-07 [CŒUR] Dénormalisation sous contrôle** — `BookingSlot.reservedCount` `booking.model.ts:42` + `Post.likeCount/commentsCount` `social.model.ts:90` + `Space.followersCount` `space.model.ts:14` + `Vendable quality.completeness` `vendable.ts:108` : `SELECT FOR UPDATE` ou triggers `AFTER INSERT ON reservations / reactions / followers` + `CHECK (reservedCount <= capacity)` + job purge `holdExpiresAt`. Supprimer incréments mémoire `space.model.ts:211` hors transaction. Criticité 🟠
- ✅ **DATA-08 [CŒUR] Typer les `Record<string,unknown>`** — Remplacer les occurrences (`VendableCharacteristics.attributes`, `MediaItem.metadata`, `CommerceOffer.metadata`, `Post.metadata`, `AuditLog.metadata`) par des schémas Zod stricts (`VendableCharacteristicsSchema`, `MediaItemMetadataSchema`, `CommerceOfferMetadataSchema`, `PostMetadataSchema`, `AuditLogMetadataSchema`) dans `@packages/schemas`. Fichiers : `packages/schemas/src/index.ts`. Criticité 🟡
- **DATA-09 [CŒUR] Portfolio Features à la CS-Cart — GSMArena Xiaomi 18 Pro Max** — Inspiré `CS-Cart 4.19 Features` `docs.cs-cart.com/4.19.x/developer_guide/api/entities/product_features.html` (`feature_type S/E/T/N/D`, `purpose filter|variation_separate|variation_one|brand|additional`, `Product Variations` `POST /product_variations/generate {product_id, feature_ids}`) : créer `portfolio_feature_groups(id,name,code)` (12 groupes GSMArena Network/Body/Display...), `portfolio_features(id, group_id FK, code, feature_type S/E/T/N/D, purpose, description, is_filterable)` (ex `chipset T/filter`, `ram S/variation_separate`, `brand E/brand`), `portfolio_feature_variants(id, feature_id FK, variant)` (12GB/16GB), `portfolio_vendable_features(vendable_id FK, feature_id FK, value_text, variant_id FK, PK vendable_id+feature_id)` + `portfolio_variation_groups(id, parent_vendable_id FK, code)` + `portfolio_variation_group_features(group_id, feature_id, purpose)`. Migrer `VendableCharacteristics.attributes` EAV flou → `portfolio_vendable_features` indexé ; génération variations Xiaomi `POST /product_variations/generate` 256/12/BK,512/12/WH,1T/16/BK → `variation_group_id` commun (cf. `portfolio/migrations/20260922162000_create_portfolio_tables.ts` à étendre). Criticité 🟠 — référence `https://www.gsmarena.com/xiaomi_18_pro_max_5g-14958.php` (8500mAh, 5G 30 bands, Snapdragon 8 Elite Extreme Gen6).

- ✅ **CIB-01 [CŒUR] Minage `Next-base: IJIDeals-CIB` `eb156d00`** — Extraction de `PaymentPort SATIM` `CIB/Edahabia` avec gestion `Money`, recharge `wallet` et `wallets/wallet_transactions escrow hold→release` avec calcul de commission platform, et documentation de `commissionRateBps` / `payoutDestination`. Fichiers : `apps/commerce/src/domain/satim-payment-port.ts`, `commerce.test.ts`.
- **GEST-01 [CŒUR] Minage `Next-base: Gestion-Commerciale` `85a7ec11`** — Comparer `portfolio_categories` arbre + `portfolio_vendable_features` `filter` vs `variation_separate` `ac99009` 14 tables vs `Gestion-Commerciale` `Vendable→Offer` `price/stock` source unique ; valider `FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61`.

> Ordre d'exécution recommandé : ROLE-01/02/04 + DATA-01/02/05 (P0) → ROLE-03 + DATA-03/04/07 (P1) → ROLE-05 + DATA-06/08/09 + CIB-01/GEST-01 (P2).

---

### 7. Vérification 2026-09-24 — Pull `ac99009`/`0ebe478`/`356422d` + PRD-0011

**Commits vérifiés :**
- `ac99009 feat(portfolio): implement CS-Cart feature schema` — 14 tables `portfolio_*` (`feature_groups/features/feature_variants/vendable_features/variant_features/variation_groups`) pour Xiaomi 18 Pro Max `gsmarena.com/14958`
- `0ebe478 feat(portfolio): update schema` — refactor `portfolio_vendables` (content/classification/quality nullable) + 14 tables consolidées (198L)
- `356422d feat(portfolio): implement space proposal workflow` — `Proposal` `proposal.ts:1` + `ProposalService` `proposal-service.ts:1` (197L `Draft→Approved` 7 méthodes) + `proposal-repository.ts` + `in-memory-proposal-repository.ts` + migration `20260924120000:1` `portfolio_proposals` (9 cols JSONB) + `proposal.test.ts` (85L)

**PRD-0011 Portfolio complet** `PRD-0011-portfolio.md:1` (v1.0, 2026-09-24, 19 routes `Dashboard→Export`) créé — **DB partiellement livrée** (`proposal` + 14 tables CS-Cart) ; **UI 19 pages reste à implémenter** (Dashboard, Vendables All/New, fiche 8 onglets, Categories arbre, Features/Groups, Variation Models, Search, Import/Export, Proposals). **Inspiration MeshJS** `G:\MeshJS-by-Jules\apps\catalog` `ARCHITECTURE.md:17` `CatalogEngine` (12 repos) + `CategoryEngine.getParentChain` + `StickerEngine` (4 conditions) + `AUDIT.md:40` monolithe 1504L — 7 idées intégrées `PRD-0011:§10`.

| Tâche | Attendu | Livré | Verdict |
|---|---|---|---|
| **ROLE-P1-01** PermissionRegistry `permission.ts` | `registerPermission({key, description, scopes, assignableBy})` + validation | **Livré** — `registerPermission`, `isRegistered`, `getRegistered`, `listRegistered`, `permission.test.ts` vert | ✅ Livré |
| **ROLE-P1-02** EffectivePermissionResolver `effective-permission-resolver.ts` | `PermissionEffect ALLOW|DENY`, `PermissionDecision`, `UserAuthorizationContext`, `DENY>ALLOW` | **Livré** — `EffectivePermissionResolver`, `UserAuthorizationContext`, `bumpVersion`, `effective-permission-resolver.test.ts` vert | ✅ Livré |
| **ROLE-P2..P7** RBAC & Audit | Tables `permissions`, `roles`, `role_permissions`, `global_user_roles`, `space_members`, `permission_overrides`, `acting_as_audit_events`, `role_audit_events` | **Livré** — Schéma relationnel Postgres complet dans `spaces/migrations/20260922162100_create_spaces_tables.ts` | ✅ Livré |
| **DATA-01** Portfolio | `vendables` + `categories`, `variants`, `translations`, `relations`, `media_assets` + 14 tables CS-Cart | **Livré** — 14 tables `portfolio_vendables/categories/vendable_categories/variants/translations/relations/media_assets/feature_groups/features/feature_variants/vendable_features/variant_features/variation_groups` dans `20260922162000:7` (198L) | ✅ Livré |
| **DATA-09** CS-Cart | `portfolio_feature_*` + Xiaomi | **Livré** — `ac99009` 14 tables, seed Groups Network/Body/Display | ✅ Livré |
| **PRD-0010 Proposals** | `portfolio_proposals` workflow 1 table mutable | **Livré** — `20260924120000:6` + `ProposalService` 7 méthodes `createDraft→approve` + `proposal.test.ts` | ✅ Livré |
| **DATA-02/03** Commerce | `commerce_offers/payment_intents/auctions/bids/carts/cart_items` | **Livré** — 7 tables créées dans `commerce/migrations.ts` | ✅ Livré |
| **DATA-04** Beam | `beam_messages` enrichi + `beam_notifications/push_subscriptions` | **Livré** — Table enrichie avec `replyTo/thread/reactions/attachments/encryptedPayload` + 2 tables notifications/push | ✅ Livré |
| **DATA-05** Booking/Citadelle/Subscription/Solara/Solidarity | Tables manquantes pour tous les 10 BACs | **Livré** — `booking_waitlists`, `booking_reminders`, `citadelle roles/mfa_secret`, `coupons`, `invoices`, `metering_buckets`, `solara_*` 6 tables, `solidarity_*` 7 tables | ✅ Livré |
| **DATA-06** Money/Timestamp | `Money` & `Timestamp` VOs + wiring domaine | **Livré** — VOs dans `value-objects.ts` + intégration `getMoney` & `calculatePayoutMoney` dans `CommerceOfferService` | ✅ Livré |
| **PRD-0011 UI** Portfolio 19 routes | Dashboard + 8 onglets fiche + Categories/Features/Variation/Search/Import/Export + Proposals UI | **Reste** — DB done, **UI à implémenter** (THEME propagation BACs `2395e23` + `PostgresThemeAssignmentsStore` + `BAC_THEME_TARGETS` pose base) | 🟡 À faire |

**Restant backlog actif** : `DATA-07` (`reservedCount` triggers), `DATA-08` (`Record<string,unknown>` typage), `THEME` UI `CompositionResolver.themeContext` → `Shell`, `PRD-0011` 19 pages, **COMMERCE source unique** (`portfolio_variants` sans `price/stock` validé), **paiements COD Algérie** (`cod_pending→delivered` par défaut) + **wallet** moyen terme (`wallets/wallet_transactions` escrow), **BAC Livraison** (`delivery_methods/cod|express/pickup`, `delivery_boys`, `deliveries` `assigned→delivered` `proofUrl`). `PRD-0010` et `PRD-0011` DB clos, PRDs eux-mêmes créés `.project/prd/PRD-0010-portfolio-proposals.md` v1.3 + `PRD-0011-portfolio.md` v1.0+MeshJS.

### 8. Commerce, Paiements COD & Livraison — décisions 2026-09-24

* **Commerce source unique offre/stock/prix** : `portfolio_variants` `20260922162000:43` `Abstract Catalog Variant without stock/price` + `FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61` `price/stock` bloqués ; `CommerceOffer` `commerce-offer.model.ts:20` `priceInCents/commissionRateBps/stockAllocation( undefined=illimité)` + `Money` VO `commerce-offer.model.ts:168` `Money.fromCents` seule vérité. Commerce ignore `portfolio_vendables` `Published` seul, jamais l'inverse.
* **Paiements Algérie — COD par défaut** : `commerce_payment_intents` `migrations.ts:67` `status` `cod_pending→cod_out_for_delivery→cod_delivered→succeeded` (pas `requires_payment_method` card-first) ; `CheckoutOrderWorkflow` `checkout-order.workflow.ts:66` `AuthorizePayment` no-op pour COD, `InventoryPort.reserve` seul à `createOrder` ; `wallet` moyen terme `wallets(id, ownerId, ownerType, balanceInCents)` + `wallet_transactions(id, walletId, type escrow_hold/release/payout, amountInCents, orderId)` escrow `hold(buyer→platform)` → `release(platform→seller net)` `calculatePayoutMoney:172` `commission 500bps`, recharge `CIB/Edahabia SATIM` plus tard.
* **BAC Livraison** `delivery` extrait de `delivery-partner.service.ts:132` `verifiedBy` → `apps/delivery` : `delivery_methods(cod|express|standard|pickup, priceInCents)`, `delivery_boys(userId FK citadelle, status available/busy/suspended, vehicle, zone, verifiedBy)`, `deliveries(orderId FK commerce_orders, methodId, boyId, status draft→assigned→picked→out_for_delivery→delivered|failed|returned, codAmountInCents Money, proofUrl)`, `delivery_assignments`. Permissions `delivery:delivery:create:space|manage:platform`, `delivery:boy:manage:platform` via `EffectivePermissionResolver` `DENY>ALLOW`. Commerce garde `stockAllocation`, Delivery ne décrémente jamais le stock.
