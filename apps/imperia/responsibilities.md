# Responsabilites — app imperia

| Champ | Valeur |
|---|---|
| Nom | `@apps/imperia` |
| Version | `1.0.0` |
| Couche | Application BAC (Layer 7) — Gouvernance & administration plateforme |
| Surnom | Dashboard admin de la plateforme MosaiX |
| Isolation runtime | `trusted` (cf. `mosaix.json`) — app privilegiee |
| Face applicative de | `@mosaix/control-plane` (serveur d'admin) + `@mosaix/plugin-engine` (gestion) + `@mosaix/migrations` (gouvernance SQL) |

## Raison d'etre

Imperia est **le dashboard d'administration de la plateforme** : c'est par lui que les
administrateurs (`admin`, `platform-governor`) configurent la plateforme, supervisent les
Bounded Application Contexts (BACs), gerent les plugins/extensions, les themes, les politiques
de gouvernance et les parametres plateforme. Aucune autre app ne porte cette responsabilite
transverse : les apps metier (commerce, solara, beam…) gerent leur domaine, Imperia gouverne
le tout.

Capabilities declarees (`mosaix.json`) :

| Capability | Role |
|---|---|
| `imperia.governance.inspect` (1.0.0) | Inspection : topologie, conformite, sante runtime |
| `imperia.governance.audit` (1.0.0) | Audit : journalisation des actions d'admin |
| `imperia.topology.query` (1.0.0) | Requete de la topologie des BACs |

Evenements publies : `imperia.policy.updated`, `imperia.audit.logged`, `imperia.circuit.tripped`.

Permissions requises (routes sous `requireAdmin`) :
`imperia:governance:inspect`, `imperia:governance:audit`, `imperia:topology:query`.

## Acces — roles globaux uniquement

Imperia est **le chemin reserve au superadmin, a l'administrateur et aux autres roles
globaux**. Acces strictement interdit a tout le reste : utilisateurs authentifies simples,
moderateurs de BAC, invites (guests), anonymes.

- Referentiel canonique des roles globaux : `PLATFORM_ADMIN_ROLES` dans
  `@mosaix/core` (`src/shell-user-state.ts`) = `["admin", "superadmin", "platform-admin",
  "platform_admin"]`, verifie via `isPlatformAdmin()` (tout `guest` = refuse).
- `platform-governor` est reconnu en plus par le `Guard` de `@mosaix/security` et par le
  `requireAdmin` d'Imperia (`imperia-controller.ts`) : c'est le role de gouvernance
  de la plateforme, donc lui aussi global.
- Mode maintenance (`MOSAIX_MAINTENANCE_MODE`, `allowedRolesInMaintenance: ["admin",
  "superadmin"]` dans `@mosaix/core/src/platform-settings.ts`) : quand il est actif,
  les ecritures des membres sont bloquees et **seuls les roles globaux conservent l'acces** —
  Imperia reste leur unique porte d'entree pour administrer la plateforme.
- Toute route mutante **et** toute route de lecture (topologie, settings, DLQ, migrations,
  audit) exigent un role global : pas de lecture anonyme ou membre, meme en mode normal
  (403 sinon). Le shell ne doit router vers Imperia qu'un etat authentifie a role global.

## Perimetres couverts

### 1. Configuration plateforme (params)
`domain/platform-settings.service.ts` — `PlatformSettingsService`
- Catalogue canonique `CANONICAL_SETTINGS_DEFINITIONS` en **7 categories** :
  `general` (cluster, env, BAC par defaut, maintenance, timezone),
  `security` (MFA, TTL session, issuer, anti-brute-force, CORS),
  `governance` (isolation multi-tenant, strict SemVer, effet par defaut des politiques),
  `plugins` (surcharge dynamique, sandbox, moderation IA),
  `appearance` (theme shell, color-mode, radius — synchronise avec `themes/*/theme.json`),
  `telemetry` (log level, rate-limit, retention audit),
  `storage` (quota espaces, pilote, strategie cache).
- Resolution a 2 sources avec trace : `environment` vs `database_override`
  (via `SettingsRepositoryPort`), surcharge a chaud conditionnee au flag
  `imperia.settings.dynamic_override`.
- Persistance Postgres quand `PostgresImperiaRepository` est injecte, sinon overrides in-memory.

### 2. Gestion des BACs (aspects transverses)
`domain/platform-topology.service.ts` — `PlatformTopologyService`
- Registre des manifests des BACs (seed : citadelle, solara, solidarity, imperia, spaces,
  commerce, beam, portfolio, booking) + `registerManifest()` pour l'enregistrement dynamique.
- Vue topologique : comptes capabilities/permissions/events par contexte, statut
  (`active` | `maintenance` | `degraded`), score de conformite calcule via
  `AppConformanceValidator` (`@mosaix/conformance`), degradation liee aux disjoncteurs.
- `domain/governance-slot-resolver.ts` — resolution des slots UI de gouvernance.
- `domain/category-analysis.service.ts`, `domain/imperia-compliance-drift.ts`,
  `domain/imperia-rego-cost-incident.ts` — analyses de conformite/drift/couts.

### 3. Gestion des plugins
`domain/plugin-manager.service.ts` — `ImperiaPluginManagerService`
- Catalogue facon marketplace (categories `commerce|security|analytics|ui|workflow|administration`),
  fiche plugin (version, auteur, `configurable`, `configurationSchema/Values`, onglets).
- Cycle de vie : `install / enable / disable / reset / uninstall / configure`.
- Reflete les plugins reels `plugins/*` (comparator, wishlist, reviews…) ; dialogue avec le
  `PluginManagementService` / `PluginSandbox` du `@mosaix/plugin-engine`.

### 4. Politiques de gouvernance
`domain/governance-policy.ts` — `GovernancePolicyRegistry`
- Politiques `allow|deny` a portee (`targetScope`, ex. `apps/*`), regles
  `equals|contains|matches`, evaluation contre un contexte.
- Changements publies via `imperia.policy.updated`.

### 5. Supervision runtime
`domain/control-plane-supervisor.service.ts` — `ControlPlaneSupervisorService`
- Dead-Letter Queue : depot `DLQRepository` (optionnel), buffer in-memory, rejeu via
  `EventRedispatcher`, inspection et purge.
- Disjoncteurs : etats `CLOSED|OPEN|HALF_OPEN`, compteurs, persistance optionnelle.
- Evenement `imperia.circuit.tripped` ; la topologie marque `commerce` en `degraded`
  quand des disjoncteurs sont declenches (cf. `PlatformHealthIndicators`).

### 6. Gouvernance des migrations
`domain/migration-governance.service.ts` — `MigrationGovernanceService`
- Inventaire des migrations framework + apps (dependances, `applied/appliedAt`),
  tri via `compareMigrationIds` (`@mosaix/migrations`).
- `previewMigrationSQL()` : apercu SQL + dry-run **avant** application — jamais d'execution
  aveugle depuis le dashboard.

### 7. Themes plateforme
`domain/platform-theme.service.ts` — `PlatformThemeService`
- Decouverte des themes (`themes/*/theme.json`, garde anti-traversal `^[a-zA-Z0-9-]+$`,
  validation `ThemeManifestSchema`, manifest invalide = ignore), resume
  (`primaryColor`, `backgroundColor`), lien avec le `ThemeRuntime` du core.
- Le choix admin persiste via `platform_settings.platform_theme_id` et le catalogue
  `MOSAIX_DEFAULT_THEME` (cf. `platform-settings.service.ts`).

### 8. Audit & traçabilite
`domain/audit-log.model.ts` (`AuditLogModel`, table `imperia_audit_logs`) +
`recordAuditLog()` dans le controller (buffer in-memory borne a 1000 entrees +
persistance Postgres best-effort).
- Chaque action d'admin (politique, plugin, setting, DLQ, migration) est journalisee
  (`actorId`, `action`, `resource`, `success|failure`, `metadata`) et emet
  `imperia.audit.logged`.

### 9. Maintenance & sante
- `domain/maintenance.service.ts` re-exporte le `MaintenanceService` canonique du core
  (mode maintenance global `MOSAIX_MAINTENANCE_MODE` : ecritures membres bloquees, acces admin maintenu).
- `GET health` : `{ status, application: "imperia", governanceState, timestamp }`.
- `presentation/imperia-view.ts` : vue dashboard (cartes topologie, sante, actions).
- `infrastructure/migrations.ts` + `postgres-imperia-repository.ts` : schema/audit/settings en Postgres ;
  strategie DB `per-app` (cf. `mosaix.json`).

## Interactions

- Monte sur `RuntimeKernel` via conteneur enfant (tenant), `isolation: trusted`.
- Lit les manifests des autres BACs **sans les importer** (registre de copies + validation) —
  aucun import direct inter-apps.
- Consomme : `@mosaix/conformance`, `@mosaix/core` (maintenance, ThemeRuntime),
  `@mosaix/migrations`, `@mosaix/sdk` (`Controller`, `Model`, `featureAsync`),
  `@mosaix/ports-feature-flags`, `@mosaix/schemas` (theme).
- Expose ses capabilities aux consoles d'admin et au shell (carte `appCard` "Imperia Gouvernance ⚡",
  `frontend/src/index.ts`).


## Donnees possedees (source de verite)

- Registre des manifests BAC, topologie, scores de conformite (vues derivees, recalculees).
- Catalogue `CANONICAL_SETTINGS_DEFINITIONS`, politiques `GovernancePolicy`, catalogue plugins, migrations (inventaire + preview), audit logs (`imperia_audit_logs`), DLQ/circuit-breakers (supervision).
- **Aucune donnee metier** : tout est gouvernance ou derive.

## References externes (par ID, jamais de jointure)

- Lit les manifests des BACs **en copie** (registre + validation, jamais d'import de code).
- References `platform_settings.platform_theme_id`, `themes/*/theme.json`.

## Invariants frontieres (ADR-0016)

1. **Gouverne, n'execute pas** (arbitrage 3, ADR-0016) : enregistre, configure, supervise — ne mute jamais les donnees metier d'un BAC.
2. **Ne contourne ni Citadelle (authN) ni les policies des BACs (authZ).**
3. **Acces global-only** : superadmin/admin/platform-admin/platform-governor (voir section Acces).

## Ecarts cible-vs-reel

- [ ] Desalignement `requireAdmin` (n'accepte pas `superadmin`) — voir section Ecarts (deja trace).

## Frontieres

- Acces reserve aux roles globaux sur **toutes** les routes, lecture comme ecriture
  (`superadmin`, `admin`, `platform-admin`/`platform_admin`, `platform-governor`).
  Tout le reste → 403, sans distinction ni fuite d'existence (pas de message revelant
  quelles ressources existent).
- Imperia **decide et supervise**, il n'execute pas a la place des BACs : pas de mutation directe
  des donnees metier d'une autre app (uniquement politiques, settings, plugins, migrations en preview).
- Persistance : DatabasePort/Postgres d'abord, fallback in-memory uniquement documente et borne.
- Aucun import depuis une autre app ; aucun acces infra direct hors ports.

## Non-responsabilites

- Ne reimplemente pas le kernel, le gateway, les adapters ni le plugin-engine.
- Ne porte aucune logique metier (commandes, feed, boutique, messagerie…).
- N'execute pas les migrations (preview/dry-run seulement) ni les rejeux DLQ sans redispatcher injecte.
- N'expose aucun secret (les settings sensibles restent des references, jamais des valeurs en clair en log).

## Ecarts connus (intention vs reel) — a combler

> Ces points sont assumes : la raison d'etre ci-dessus reste la cible, meme quand
> l'implementation actuelle n'est que partielle (seeds in-memory, depots optionnels).

- [ ] `PlatformTopologyService` : manifests **seedes en dur** — brancher sur la decouverte reelle
      du kernel (`AppDiscovery` / `registerManifest` au boot de chaque BAC).
- [ ] `ImperiaPluginManagerService` : catalogue **seede** (comparator, wishlist, reviews, MFA) —
      synchroniser avec le `PluginManagementService` reel (etat `LOADED/ACTIVE…`, `plugins/*`).
- [ ] `ControlPlaneSupervisorService` : `DLQRepository` et `EventRedispatcher` **optionnels** —
      injecter les implementations production (outbox/DLQ du core) pour un rejeu effectif.
- [ ] `MigrationGovernanceService` : inventaire **seede** (4 entrees) — brancher sur le registre
      reel `@mosaix/migrations` (runner, audit trail).
- [ ] Audit : buffer in-memory + persistance best-effort (`catch` logue) — durcir (outbox, retry,
      lecture paginees, retention `MOSAIX_AUDIT_RETENTION_DAYS` appliquee).
- [ ] Elargir les capabilities declarees a la realite (`imperia.settings.*`, `imperia.plugins.*`,
      `imperia.migrations.preview`, `imperia.dlq.*`) ou documenter pourquoi elles restent internes.
- [ ] `category-analysis`, `compliance-drift`, `rego-cost-incident` : preciser contrat/scheduling
      (one-shot vs daemon) et leurs consommateurs.
- [ ] **Desalignement critique sur les roles** : `requireAdmin` d'Imperia n'accepte que
      `admin` + `platform-governor`, alors que `PLATFORM_ADMIN_ROLES` (core) definit
      `admin | superadmin | platform-admin | platform_admin` — un `superadmin` serait donc
      aujourd'hui **refuse** par le dashboard qui lui est destine. Aligner `requireAdmin`
      sur `PLATFORM_ADMIN_ROLES + platform-governor` (via `isPlatformAdmin()`), en fail-closed
      (role inconnu = 403).

## Criteres de sante

- [ ] Conforme a `pnpm check:conformance` + `check:manifests` (capabilities/events/permissions injustifies = echec).
- [ ] Toutes les routes (lecture + mutation) couvertes par des tests : 403 pour anonyme,
      guest, membre et moderateur BAC ; 200 pour chaque role global
      (`superadmin`, `admin`, `platform-admin`, `platform-governor`).
- [ ] Chaque mutation de gouvernance emet son evenement et ecrit un audit log.
- [ ] Aucun seed in-memory utilise en production sans depot injecte (ou ecart trace ci-dessus).
- [ ] OpenAPI genere sans erreur ; carte `appCard` et slots UI rendus dans le shell.
