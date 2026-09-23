# Changelog

## 2026-09-22 — Architecture & Static Assets Management (`@mosaix/http` & `/public`)

### Added
- **`@mosaix/http` Static File Engine (`serveStaticFile`)** :
  - Gestionnaire de fichiers statiques haute performance avec streaming direct (`fs.createReadStream`).
  - Sécurité anti-traversée de répertoire (*Path Traversal Protection* via `path.resolve` et contrôle de confinement).
  - Gestion automatique des en-têtes HTTP de mise en cache (`ETag` déterministe, `Last-Modified`, code HTTP `304 Not Modified`, `Cache-Control`).
  - Négociation complète des types MIME (`.svg`, `.ico`, `.webmanifest`, `.png`, `.jpg`, `.css`, `.js`, `.woff2`, etc.).
  - Suite de tests unitaires dédiée : `packages/http/src/static-file-handler.test.ts` (6/6 tests validés).
- **Dossier `/public` à la racine** :
  - `favicon.svg` : Icône vectorielle haute fidélité du logo MosaiX.
  - `logo.svg` : Logo vectoriel complet de la marque MosaiX.
  - `site.webmanifest` : Manifest PWA officiel pour l'installation autonome et les métadonnées plateforme.
  - `robots.txt` : Directives de crawl et indexation web.
- **Intégration Shell (`src/start.ts`)** :
  - Branchement du gestionnaire `serveStaticFile()` au niveau du serveur principal.
  - Liaison des balises `<link rel="icon" ...>` et `<link rel="manifest" ...>` dans les templates HTML.

### Validation
- `npm run lint` → **0 erreurs, 0 avertissements**.
- `vitest run packages/http/src/static-file-handler.test.ts` → **6/6 tests passés**.
- `compile_applet` → **Compilation réussie**.


### Added
- **`Identity BAC` Endpoints MFA & Sécurité** :
  - Endpoint `POST /identity/mfa/setup` : Génération de secret TOTP et d'URL `otpauth://` pour l'enregistrement d'application d'authentification.
  - Endpoint `POST /identity/mfa/verify` : Validation du code à 6 chiffres.
- **`Solara BAC` Persistance Postgres Dynamique** :
  - Prise en charge de l'injection optionnelle de `PostgresSocialRepository` dans `SolaraSocialService`.
  - Persistance asynchrone automatique des publications dans la base PostgreSQL lors de l'appel à `createPost()`.
- **`Beam BAC` Persistance Postgres Dynamique** :
  - Prise en charge de l'injection optionnelle de `PostgresMessagingRepository` dans `BeamMessagingService`.
  - Persistance asynchrone automatique des conversations et messages dans PostgreSQL (`createConversation()`, `sendMessage()`).
- **`Commerce BAC` Route Webhook de Paiement** :
  - Endpoint `POST /commerce/checkout/webhook` pour la gestion des événements de paiement (`payment_intent.succeeded`, `checkout.session.completed`) et la mise à jour automatique des statuts de commandes (`PAID`).

### Validation
- `compile_applet` → **PASS** (compilation réussie).
- `restart_dev_server` → Dev Server opérationnel sur port 3000.

## 2026-09-19 — UniTheme Composition Persistence & Preset Exporter/Importer (GAP Resolutions)

### Added
- **`GAP-IHM-01` Persistance sur disque des Overrides de Composition** : Enregistrement et rechargement automatique de la configuration des grilles et emplacements dans `/.mosaix/composition-overrides.json` via les helpers `saveCompositionOverridesToFile()` et `loadCompositionOverridesFromFile()`.
- **`GAP-IHM-03` Exporter & Importer de Presets de Thèmes & Composition** :
  - Route d'API `GET /api/theme/preset` : Exporte au format JSON la configuration complète du thème actif et des blocs de composition (`mosaix-theme-preset.json`).
  - Route d'API `POST /api/theme/preset` : Importe, applique et sauvegarde un fichier JSON de configuration de thème.
  - Boutons **"Exporter Preset"** et **"Importer Preset"** (avec sélecteur de fichier local) intégrés dans le pied du tiroir *Live Theme Customizer*.
- **`shell.usermenu.actions` (Slot User Menu)** : Injection de 3 contributions dans le menu déroulant de profil utilisateur (`src/start.ts`) :
  - **`imperia:governance-context-switcher`** : Sélecteur dynamique de tenant / organisation (*MosaiX Global*, *Solara Org*, *Imperia Council*).
  - **`beam:presence-status-selector`** : Sélecteur de statut de présence (*En ligne*, *Occupé*, *Absent*).
  - **`identity:security-settings-btn`** : Accès rapide aux paramètres de sécurité MFA & Clés API.
- **`solara:rich-post-composer-widget` (Slot `shell.home.widgets`)** : Éditeur de publication Solara multi-formats avec onglets (*Texte*, *Média*, *Sondage*), champ d'options de sondage réactif et sélecteur de portée (*Public*, *Réseau MosaiX*, *Gouvernance*).
- **`solara:post-types-showcase-widget` (Slot `shell.home.widgets`)** : Démonstration interactive du rendu des conteneurs de publications du réseau social Solara.
- **`imperia:active-ballots-widget` & `commerce:daily-deal-widget` (Slot `shell.home.widgets`)** : Blocs de scrutin de vote de gouvernance en direct et offre promotionnelle Commerce.

### Changed
- **Live Theme Customizer Drawer (`src/start.ts`)** : Prise en charge intégrale des nouveaux blocs Solara dans l'onglet *Gestionnaire de Blocs* (redimensionnement réactif 1-12 colonnes, masquage/affichage, styles Glass/Flat/Bordered).
- **Helper `selectPostType(type)`** : Script client pour le basculement dynamique des champs de formulaire de post dans le compositeur Solara.

### Validation
- `compile_applet` → **PASS** (compilation 100% réussie).
- `restart_dev_server` → Dev Server opérationnel sur le port 3000.
- `curl` check → Validation de l'injection des identifiants UniTheme et des éléments HTML réactifs.

## 2026-09-16 — Audit dogfeeding + décisions interactives (framework & production)

### Added
- **`packages/auth/src/jwt-service.ts`** : `JwtService` canonique (HMAC-SHA256, `timingSafeEqual`, `exp`) + `resolveJwtSecret()` (fail-fast prod).
- **`packages/events/src/messaging-publisher.ts`** : `resolveMessageBusDriver()` (`MESSAGE_BUS_DRIVER=kafka|rabbitmq|memory`).
- **`src/outbox-messaging-publisher.ts`** : `createOutboxMessagingPublisher()` (Phase 21, Kafka/RabbitMQ/memory).
- **Backlog BL-017–BL-023** : triage au cas par cas des adapters Postgres + stores identity + worker séparé Phase 21.

### Changed
- **Fail-fast JWT uniforme** (`src/index.ts`) : `resolveGatewayJwtSecret()` throw en prod si secret absent (DEC-JWT-001).
- **`scripts/db-backup.ts`** : vrai `pg_dump` via `execFileSync`, copie SQLite, échec bruyant — plus de dump mock (DEC-BACKUP-001).
- **`IdentityAdapters`** : `sessionStore`/`tokenStore`/`credentialStore` injectables (DEC-SESS-001, partiel).
- **Adapters commerce/spaces** : import `OrderModel` du domaine, import `DatabasePort` (DEC-ADAPT-001, partiel).
- **`tsconfig.json`** : paths `@mosaix/auth`, `@mosaix/pipeline`, `@mosaix/events`, `@mosaix/adapter-*`.
- **`vitest.config.ts`** : alias `@mosaix/auth`, `@mosaix/gateway`, `@mosaix/pipeline`.
- **Docs** : `active-backlog.md` (décisions + BL-017–BL-023), `roadmap.md` (Phase 21 détaillée), `dashboard.md`, session reports 2026-09-16.

### Validation
- `tsc --build` packages touchés : OK ; suites vitest ciblées (gateway, auth, events, identity, commerce, spaces, solara, sdk, control-plane, telemetry) : vertes.
- `tsc --build tsconfig.build.json` global : encore en échec sur erreurs pré-existantes (adapters solara/beam/solidarity/imperia/portfolio, `ui-runtime`, `shell-composition` rootDir) — voir BL-017–BL-021.

## 2026-09-02 — Audit Conformité Applications MosaiX (8/8)

### Added
- **Rapport d'audit** (`.project/reports/apps-audit-2026-09-02.md`) : Audit de conformité des 8 applications `@apps/` (manifest MOSAIX-APP, schéma canonique, structure fichiers, patterns IDs, cross-field consistency).

### Changed
- **`apps/commerce/package.json`** : `name` corrigé de `"commerce"` → `"@apps/commerce"` (conformité schéma canonique).
- **`apps/identity/package.json`** : `name` corrigé de `"identity"` → `"@apps/identity"`.
- **`.project/dashboard.md`** : Ajout de la ligne d'audit conformité 2026-09-02.

### Risks / Findings
- **Chantier P0 détecté** (`.project/risks/framework-core-build-tests-broken-2026-09-02.md`) : framework core build/lint/tests cassé depuis `c972474` (F-1 `kernel.ts`, F-2 `rootDir` core↔http, F-3 résolution ESM `ApplicationRegistry is not a constructor`, F-4 227 erreurs lint). Enregistré comme `TASK-P0-00` dans le backlog consolidé. Traité distinctement du périmètre « applications » (validé à 100%).

### Removed
- **`apps/identity/src/composition-root.ts`** : Composition root racine redondante supprimée (remplacée par `src/index.ts` canonique avec `createIdentityApp`).
- **Artefacts build orphelins** : `apps/identity/src/infrastructure/composition-root.{d.ts,d.ts.map,js.map}` supprimés.

### Validation
- `pnpm check:conformance` → **PASS** (8/8 apps).
- `node scripts/validate-canonical-app-schema.mjs` → **PASS** (8/8 apps).
- Structure : 8/8 apps avec `src/index.ts`, `frontend/src/index.ts`, `src/infrastructure/`, 0 `composition-root.ts` résiduel, 0 couplage inter-app.

## 2026-08-16 — Nettoyage backlog .project/ + consolidation

- **Backlog consolidé créé** : `.project/backlog/consolidated-backlog-2026-08-16.md` — fusion de tous les backlogs (`phase-1-mvp-core`, `ports-adapters-foundation`, `ports-adapters-audit`, `extensibility-improvement`, `extensibility-audit`, `structural-gap-audit`, `audit-ports-adapters-v2-reliquats`, `prd-0006-migrations-phases`, `ecosystem-phase-0-foundations`, `audit-repository-health`, `SEC-AUTH-*`), working items et reports findings.
- **Doublons identifiés** : T-EXT-05 = T-I1, T-EXT-03 = CORE-01, T-GAP-011 = T-A3 partiel, T-GAP-012 = T-A7, T-19 couvre T-F1..T-I9, T-MIG-0..7 terminés, T-08/T-09 candidats archivage, T-A1/A2/A6 terminés.
- **Actions de nettoyage** : archiver working items terminés, fusionner rapports redondants (audit V1 vs V2, structural-gap working vs report), supprimer doublons.
- **Politique confirmée** : pas de suppression d'adapters orphelins (pré-construits pour usages futurs), pas de suppression d'ADR/PRD/workflows.

## 2026-08-11 — Gate Prettier restauré + worktree extensibilité (T-EXT-04/11/12/13)

- **Gate `pnpm check` entièrement vert** : prettier repassé sur **26 fichiers** des
  chantiers d'extensibilité (adapters, core, contracts/schemas/sdk) via 3 subagents
  parallèles + **2 fichiers dette pré-existante** (`capability-schemas.ts`,
  `capability-registry.test.ts`, déjà en échec dans HEAD). **506 tests verts (69
  fichiers)**, build/lint/typecheck/format OK. Le blocage CRLF/`endOfLine: "lf"`
  (note du 2026-08-09) est levé.
- **Worktree (non commité)** — T-EXT-04 (Runtime plugin) : `plugin-module.ts`,
  `plugin-registry.ts` + `plugin-errors.ts` (clé `owner:id`, `install(ctx)`,
  validation manifest), `schemas/plugin.ts` (`PluginManifestSchema`), tests SDK —
  extension service hors 6 canoniques, union `PluginExtensionPoint` conservée.
- **Worktree** — T-EXT-11 : validation des **services canoniques requis à
  l'install** (`kernel.ts`) — échec rapide avec erreur listant tous les services
  manquants, escape hatch `setService` d'un module custom accepté (6 tests).
- **Worktree** — T-EXT-12 : réconciliation EventStore core ↔ port event-store
  documentée (`.project/architecture/event-store-duality.md`).
- **Worktree** — T-EXT-13 : durcissement adapters — `sms-twilio` (throw si
  `accountSid`/`authToken` manquants, mock explicit `{ mock: true }`),
  `featureflags-launchdarkly` (`mockKey` supprimé), `email-smtp` (`jsonTransport`
  opt-in explicite). Rapport session jules : `session-2026-08-11-jules.md`.
- **Gate** : `pnpm check` ✅ (build, lint, typecheck, 506 tests, prettier).

## 2026-08-11 — T-EXT-03 : contrat de capability câblé de bout en bout (CORE-01)

- **`CapabilityRegistry`** (`capability-registry.ts`) : `validateCapability` réel
  (stub supprimé) appliquant `inputValidator`, ajout de `validateOutput`
  (`outputValidator`), ajout de `bindContract(id, ownerApp, contract)` (fusion
  des validateurs sans écraser version/entry/permissions). `PayloadValidator`
  ré-exporté depuis `event-schema-registry` — fin de la duplication.
- **`RuntimeKernel`** (`kernel.ts`) : `register()` dérive les `permissions`
  (`category: "capability"` + préfixe `${app}:${capId}:execute:`) et normalise
  `entry` (`${runtime.entrypoint}#${capability.id}`) — fini les placeholders ;
  `executeCapability()` valide entrée avant / sortie après (levée
  `CapabilityError`) ; `bindCapabilityContract` owner-scoped (single ownership).
- **SDK** (`packages/sdk/src/index.ts`) : `MosaixApp.registerCapabilityContract(
  capabilityId, { inputValidator?, outputValidator? })`.
- **Identity (référence)** : `application/capability-schemas.ts` (Zod, 6
  capabilities) ; les 6 contrats liés dans `createIdentityApp`.
- **Tests : +8** (registry 2, kernel 5, identity 2, sdk 2). **453 tests verts.**
- **Gate** : `pnpm build` + `pnpm lint` + `pnpm test` ✅.

## 2026-08-10 — T-EXT-01 + T-EXT-02 : registre de services ouvert + observabilité substituable

- **T-EXT-01 — `KernelServices` ouvert** (`kernel-module.ts`, `kernel.ts`) :
  le registre interne passe d'une union fermée à un `Map<string, unknown>` ; les
  **6 services canoniques** restent typés via `KernelServiceName`
  (`KERNEL_SERVICE_NAMES` exporté) ; surcharges `ctx.setService`/`ctx.getService` —
  service canonique absent → `ServiceNotInstalledError`, extension absente →
  `undefined` ; un `KernelModule` peut apporter un **7e domaine de service**
  consommé par un autre module, sans édition de `@mosaix/core`. Backward-compat
  100% (getters existants inchangés). Tests : +4 (fournisseur/consommateur
  `search`, duplicate reject, extension manquante).
- **T-EXT-02 — Observabilité substituable** : construction des trois implémentations
  (lignes 147-149 du constructeur) **sortie du kernel** et remplacée par
  `ObservabilityModule` (`packages/core/src/modules/observability-module.ts`) qui
  fournit `logger`/`metrics`/`tracer` via `setService` ; `defaultObservability(logLevel)`
  regroupe les défauts `ConsoleLogger`/`InMemoryMetrics`/`InMemoryTracer` ;
  substitution via `KernelOptions.observability` (pino/OTel demain, T-EXT-05) ;
  seams seedés **avant** l'installation des autres modules (consommation pendant
  `register()` possible) ; le module n'est pas tracé dans `listModules()`
  (`["capabilities","events","permissions"]` inchangé). Tests : +2 (seams vus par
  un module en `register`, substitution par options). **436 tests verts.**
- **Gate** : `pnpm check` ✅ (build, lint, typecheck, 436 tests, prettier).

## 2026-08-09 — Hygiène repo : comptage tests vérifié + artefacts compilés nettoyés

- **Comptage tests vérifié** : 60 fichiers `*.test.ts`, **374 tests, 0 échec** —
  cohérent entre `pnpm test` et `pnpm vitest run`. Les écarts historiques
  (206/207/270) sont résolus ; `dashboard.md` mis à jour.
- **Artefacts compilés obsolètes supprimés de `src/`** : les `.js` / `.d.ts` /
  `.map` en racine (`src/index.*`, `src/shell/landing/resolve-shell-landing.*`)
  n'étaient pas couverts par `.gitignore` et risquaient d'être commités ; le
  build émet désormais uniquement dans `src/dist/` (gitignoré).
- **Note « policy supply-chain bloquante » obsolète** : `pnpm install
  --frozen-lockfile` fonctionne ; l'ancienne note du dashboard supprimée.
- **Comptes ports/adapters corrigés** dans `dashboard.md` : 19 ports, 29 adapters.
- ⚠️ **Gate `pnpm check` toujours rouge sur Windows** : `core.autocrlf=true`
  checkout CRLF alors que prettier exige `endOfLine: "lf"` (385 fichiers).
  Non traité (décision de configuration Git/prettier à valider).

## 2026-08-08 — PRD-0008 V2.2 : résolution de thème par cible (ThemeTarget générique)

- **Verrouillage cible de résolution** : le Theme System = système de résolution
  de thème **par cible** (`ThemeTarget = { type, id }` générique), le kernel
  reste totalement agnostique des entités (`space`, `store`, `organization`,
  `community` ne sont que des valeurs de `type`).
- **Capabilities `ThemeTargetRegistry`** (G3) : `userSelectable` /
  `adminConfigurable` — « thémable » ≠ « configurable ». Déclaratif (manifest)
  et programmatique (SDK) alimentent le **même** registre.
- **`CompositionContext.target`** (G4, Q-T-8 résolue) : champ `target`
  (et non `themeTarget`) = **entité de composition courante**, partagée par
  Theme / Policies / Placements / Renderers. Ajout `user.identityType`.
  Amendement ADR-0007 §6.
- **Règles d'or** (INV-THEME-006/007) : `ThemeTargetRegistry` = registre de
  contrats, **pas un second kernel** ; `ThemeCompiler.compile(tokens, mode)` —
  jamais `compile(entity, theme)`.
- **Catalog hors kernel** (G5) : Catalog/Preview/Assignment = Control Plane
  (Governance), seul le port reste dans `contracts/core`.
- SDK à trois niveaux (`get` / `resolve` / `targets`+`assign`/`unassign`).
- Structure cible des packages (contracts/theme, core/theme, sdk/theme, ui/theme,
  shell/theme, apps/governance/theme) consignée au §9.

## 2026-08-08 — Governance = application optionnelle (règle inversée Control Plane)

- **Décision architectural** : Governance n'est **plus** le Control Plane dont la
  plateforme dépend. Le Control Plane des registries est porté par le Kernel ;
  **Governance est une application optionnelle qui administre** ces capacités
  quand elle est installée. Règle : *aucune capacité fondamentale de MosaiX —
  Kernel, Shell, Server, App Registry, routing, configuration, exécution — ne
  dépend de sa présence*.
- **Verrouillée en** : `.project/working/governance-execution-plan.md` (règle inviolable + D14)
  et `.project/working/governance-questions.md` (règle finale + règle d'inversion).
- Affecte le Shell : `/` doit fonctionner sans Governance — sidebar, config de
  l'app par défaut, découverte des apps, permissions (kernel), expériences (apps).
- Mises à jour : PRD-0007 §2/§3 (positionnement + invariant « Shell sans app »),
  README (§Control Plane), terminologie (*administrer* remplace *gouverner* pour
  la responsabilité de Governance).

## 2026-08-08 — Shell V2.1 : brique d'accueil par défaut (T-SH.0.0)

- **Shell init** `src/` : tomaison du dossier racine du Shell (décision Q10), non
  packaged, aliased `@src/*` dans `vitest.config.ts` ; déclaré en reference
  `tsconfig.build.json` (`src/tsconfig.json` composite, `rootDir .`, déclarations).
- **Landing decision** `src/shell/landing/resolve-shell-landing.ts` :
  `resolveShellLanding(registeredApps)` → `{kind:'default', template:'home.html'}`
  si zéro app enregistrée, sinon `{kind:'composed'}`. Unité logique pure, sans I/O
  (l'implémentation serveur viendra dans T-SH.2).
- **Template défaut** : `home.html` déplacé de la racine vers
  `src/shell/templates/home.html` — page d'accueil par défaut propriété du Shell,
  remplaçable par chaque plateforme.
- **Tests** `src/shell/landing/resolve-shell-landing.test.ts` : 6 cas (vide → défaut,
  1 app, n apps, non-mutation, garde `isDefaultLanding`) — verts.
- **Gates** : `pnpm build` OK, `pnpm lint` OK, `pnpm test` 6/6.
- **Révision config** : `rootDir` corrigé en `.` (anti-pattern `src/src` diagnostiqué
  lors du build initial).

## 2026-08-08 — ADR-0007 révisé + PRD-0007 V2.1 : verrouillage sémantique

- **ADR-0007 (révisé)** `.project/decisions/ADR-0007-experience-composition-model.md` :
  révision architecte intégrée et verrouillée :
  - **Règle inviolable Surface ≠ layout** : `SurfaceContract`/`SlotContract`
    sont des **déclarations** sans méthode runtime (pas de `render`/`mount`/
    `unmount`/`hide`/`show`/`resolve`) ; la mécanique vit dans
    « CompositionRuntime ».
  - **Matrice d'ownership Structural/Contextual** : le Shell possède le
    structural ; les apps **contribuent** aux slots structuraux mais ne
    redéclarent **jamais** `header`/`navigation`/`sidebar` ; elles déclarent
    les surfaces contextuelles de leurs expériences.
  - **Placement = couple discret `{ surfaceId, slotId }`** (une contribution
    projetée sur plusieurs couples), pas un attachement à une surface.
  - **`kind:'component'` présent mais désactivé par défaut** dans le
    RendererRegistry ; activation gouvernée explicite.
  - Contrats annotés (§1) : `SurfaceContract` (avec `ownedBy`), `SlotContract`
    (accepts), `PlacementContract` — figés avant implémentation (gate P0).
- **PRD-0007 V2.1** `.project/prd/PRD-0007-shell-experience.md` : révisions
  R17–R20 alignées (Surface ≠ layout, frontière + matrice d'ownership §7.2,
  `kind:'component'` désactivé par défaut, verrouillage sémantique prérequis).
  Phase 0 = ticket **T-SH.0.0** (verrouillage sémantique) avant T-SH.0.1.
- **Ressources** : table des revisions §1, §5.1/5.3/5.4, §6.2, §7.1/7.2,
  §17.

## 2026-08-08 — PRD-0007 V2.0 : Shell Composition Model (ADR-0007)

- **ADR-0007** `.project/decisions/ADR-0007-experience-composition-model.md`
  (Accepted) : le modèle `Surface → Slot → Contribution (intent sémantique) →
  Placement → Policy → Renderer` est établi. La Contribution devient un
  **intent sémantique** sans renderer ; une contribution → **placements
  multiples** ; 4 états disjoints `registered → eligible → visible → active` ;
  **CompositionPolicyEngine** (7 types) + **CompositionContext** unique ;
  convergence navigation/composition (kinds unifiés, `NavigationExtension` et
  `surface-core` éliminés). Emplacement : `contracts/experience → schemas →
  core/composition → sdk/experience → apps+shell → ui`. Score 34/45.
- **PRD-0007 V2.0** `.project/prd/PRD-0007-shell-experience.md` : révisions
  R8–R16 intégrées (surfaces déclaratives, slots typés, placements multiples,
  renderer registry kind×device, command surface, états de composition,
  policies). Phases T-SH.0 (Contracts & CompositionRuntime) → T-SH.7 ; DoD et
  risques révisés (sur-abstraction, second kernel).
- **PRD-0007 V1.0** : version initiale sans Composition Model (URL-centric,
  pipeline de visibilité simple).

## 2026-08-08 — Analyse shell IJIDeals/MeshJS + PRD-0007 Shell MosaiX

- **Rapport** `.project/reports/shell-analysis-meshjs-2026-08-08.md` : chaîne de
  démarrage, modèle surfaces/contributions, 4 canaux de navigation, pipeline de
  visibilité, montage MFE Shadow DOM, header/menu, recherche fédérée, gaps.
- **PRD-0007** `.project/prd/PRD-0007-shell-experience.md` (V1.0) : Shell =
  couche d'expérience dans `src/` racine (alias `@src/*`, Q10) ; frame,
  navigation URL-centric (R3), ExperienceCatalog via `ExperienceContract`,
  montage isolé + retry/fallback (R4), pipeline visibilité unique (R5), phases
  T-SH.0–T-SH.7, DoD V1, risques. Déps `contracts`/`schemas`/`sdk` ; jamais `apps/*`.

## 2026-08-06 — T-MIG-1 (Phase 1) : moteur durci — transactions, batches, rollback

- **`DatabasePort.transaction<T>(fn)`** (PRD §26, validé utilisateur) : atomicité
  par migration, sémantique BEGIN/COMMIT/ROLLBACK propriété de l'adaptateur.
  Adapter SQLite : transaction réelle au niveau supérieur, SAVEPOINT imbriqué
  sous le lock `BEGIN EXCLUSIVE`.
- **Batches** : `ExecutedMigration.batchId`, toutes les migrations d'un run
  partagent le même batch (PRD §30) ; le rollback par défaut annule le dernier
  batch.
- **Rollback ciblé** : `{ kind: "steps", count }` (PRD §31), toujours en ordre
  inverse d'application (PRD §29) — corrige l'écart ADR noté à T-MIG-0.
- **Hiérarchie d'erreurs PRD §33** : base `MigrationError` + AlreadyApplied /
  Lock / Transaction / Execution ; Runner typé (`MigrationLockError`,
  `MigrationExecutionError`).
- **12 tests ajoutés → 237 totaux verts, build + lint OK.**
- **Prochaine action :** T-MIG-2 (Phase 2 Schema Builder).

## 2026-08-06 — T-MIG-0 (Phase 0) : critère de succès validé — adaptateur SQLite

- **`@mosaix/adapter-database-sqlite` créé** : `DatabasePort` implémenté sur le
  module natif `node:sqlite` (Node ≥ 22.5) — **zéro dépendance externe**
  (contourne la policy supply-chain). Lock migrations = `BEGIN EXCLUSIVE ...
  COMMIT` enveloppant le plan (processSafe, R3) ; corps de migration
  multi-instructions supportés via `exec`.
- **Critère de succès Phase 0 validé** : création d'une table SQLite
  uniquement via le pipeline complet `Registry → Planner → Runner → DatabasePort`
  (3 tests : création de table, re-run idempotent → plan vide, capacités de
  verrouillage). **225 tests totaux verts.**
- **Install pnpm débloquée** : exclusion des paquets `@aws-sdk` problématiques
  de la policy `minimumReleaseAge` → `pnpm install` passe, lockfile régénéré
  et commité.
- **Prochaine action :** relecture ADR-0006 vs contrats, décider swap
  checksum SHA-256, passer à T-MIG-1 (Phase 1).

## 2026-08-06 — Tâches Phase 0-7 PRD-0006 créées (prérequis spike levé)

- **Backlog phases créé** : `.project/backlog/prd-0006-migrations-phases.md` — **T-MIG-0** (Phase 0 : invariants R1-R14 + contrats + tests socle, base spike à consolider), **T-MIG-1** (Phase 1 : Registry/Planner/Runner/Store durcis + transactions/verrouillage/batches/rollback), T-MIG-2 (Schema Builder), T-MIG-3 (SQLite Adapter — bloqué policy), T-MIG-4 (PostgreSQL Adapter — bloqué policy), T-MIG-5 (CLI), T-MIG-6 (Modules et sources), T-MIG-7 (Production Hardening).
- **Priorité** : T-MIG-0 avant tout, puis T-MIG-1 (le spike a posé les fondations) ; Phases 3-4 dépendent du déblocage de `pnpm install`.
- **Gates** : Phase 0 avant tout ; ADR-0006 relue à la fin de l'implémentation.

## 2026-08-06 — Spike T-ADR-0006 : prototypes Registry → Planner → Runner validés

- **`@mosaix/ports-database` créé** : `DatabasePort` (execute/query/acquireMigrationLock) + `DatabaseCapabilities` (dialect, transactions, lock) + `MigrationLock` + `LockCapabilities` (distributed/processSafe/runtimeSafe). Pattern ports autonome, `eslintBoundaries: database-port`, zéro dépendance.
- **`@mosaix/migrations` créé (prototype spike)** :
  - `MigrationRegistry` (agrégation des providers, checksum au chargement R2, collisions d'identité R9, ordonnancement rank+canonique R10) ;
  - `MigrationPlanner` (desired state → plan R12, `MigrationPlan` immuable R13, **idempotence R14**, `MigrationMissingError` R5, `MigrationChecksumError` R2, `MigrationResourceConflictError` R9) ;
  - `MigrationRunner` (exécute uniquement le plan validé, lock adaptateur R3, enregistre l'origine dans le Store R7) ;
  - `InMemoryMigrationStore`, `computeChecksum` (FNV-1a 64, runtime-agnostique), `parseMigrationId`/`compareMigrationIds` (tri numérique R6).
- **Validation** : build `tsc` EXIT=0, lint EXIT=0, **222 tests verts** (14 nouveaux spike + 208 existants), prettier conforme.
- **Boundaries** : éléments `database-port` et `migrations` actifs dans `eslint.config.mjs` ; `migrations` autorisé vers `database-port`, `adapters` autorisé vers `database-port`.
- **Note de spike** : `.project/reports/spike-t-adr-0006-2026-08-06.md` — résultats observés, limites (drivers SQL, verrouillage réel bloqués par la policy supply-chain).
- **Impact** : décisions R1-R14 validées par prototype (sauf R3/R4 empiriques, bloquées) → **les tâches Phase 0-7 peuvent être créées**.
- **Correctifs associés** : `fix(kernel)` (hook `onAppStateChanged` passé en premier argument — régression ARCH-012 corrigée, test de no-self-grant sur kernel sans grants) — 208 tests existants restaurés.

## 2026-08-06 — ADR-0006 Accepted (Database Port and Migration Engine Architecture) + R12 confirmée + R14

- **ADR-0006 rédigée et acceptée** : `.project/decisions/ADR-0006-database-port-migration-engine.md` — fige les décisions **R1-R14** du PRD V2.3 avant toute implémentation Phase 0-7.
- **Frontières architecturales fortes** :
  - **Registry / Planner / Runner** : le Registry agrège et valide les identités, le **Planner décide** (delta + ordre + collisions SQL), le Runner exécute uniquement le plan validé — inspectabilité de l'installation avant exécution ;
  - **`MigrationPlan` immuable** : `{ id, createdAt, sourceVersion, operations }` — le Runner reçoit un plan déjà calculé et ne peut pas le transformer (`A→B→C` ≠ `A→C`) ;
  - **Idempotence du Planner (R14)** : même état source + même état cible → même plan (tests reproductibles, audit fiable, prévisualisation, reprise après interruption).
- **R12 confirmée — desired state → plan** (modèle Kubernetes/Terraform, cohérent Control Plane) : le Provider expose son **état complet courant**, le Planner compare avec le Store et produit un delta déterministe, le Runner exécute uniquement le plan validé et ne calcule jamais un upgrade lui-même.
- **Contrats figés** : `MigrationProvider` (ownerId/migrations), `MigrationPlan`, règles de collision identité/SQL, ordonnancement global framework+apps, rollback ≠ uninstall, Store avec origine, checksum au chargement, locking par l'adaptateur, `SQLiteDriver` driver-agnostique.
- **PRD-0006 → V2.3** : §43ter (R12 confirmée), §20bis (`MigrationPlan` immuable + idempotence), Annexe A **20 décisions** (R1-R14), tableau des révisions R14 ajouté.
- **Spike T-ADR-0006** : ADR rédigée (livrable principal) ; restent les prototypes de validation (Planner/collision detector, drivers, verrouillage) — partiellement bloqués par l'install.
- **Prochaine action :** commit de la base (PRD + gouvernance + ADR-0006), puis prototype du Planner / collision detector au spike, puis création des tâches Phase 0-7.

## 2026-08-06 — PRD-0006 V2.3 : gouvernance de composition (R8-R13)

- **PRD-0006 → V2.3** : `.project/prd/PRD-0006-migrations-engine.md` — précisions de gouvernance, issues des précisions architecte du 2026-08-06 :
  - **R8 — Sémantique du Manifest** : une application ne déclare que son espace local (`domain.migrations`) ; l'`owner` est ajouté par la couche de composition ; deux applications ne fusionnent jamais le même namespace ;
  - **R9 — Deux règles de collision distinctes** : collision d'**identité complète** (`owner.module.version.sequence_name`, détectée au chargement par le Registry) et collision de **ressource SQL** (ex. `appA.users` vs `appB.users`, détectée au niveau Blueprint/compilation par le Planner) ;
  - **R10 — Ordonnancement global explicite** : framework bootstrap → modules framework → DAG des dépendances applicatives → migrations applicatives ;
  - **R11 — Cleanup migrations formalisées** : même owner, propre checksum, auditées dans le Store, jamais de réutilisation des migrations d'installation ;
  - **R12 — Contrat d'upgrade des Providers** : le Provider présente son **état complet courant** ; le Planner calcule le delta vs Store — décision recommandée, **à confirmer au spike T-ADR-0006 avant le système d'installation** ;
  - **R13 — Migration Planner** : couche intermédiaire `Registry → Planner → Runner` produisant un `MigrationPlan` explicite (`PlannedMigration[]`, `up`/`down`) — dry-run, affichage, audit, approbation Control Plane, reprise après interruption.
- **Frontière de responsabilités** : Registry agrège/valide les identités, Planner décide (delta + collisions SQL), Runner exécute — aucun ne fusionne avec les autres.
- **ADR-0006 (Annexe A)** : **19 décisions** à figer (13 précédentes + 6 nouvelles : sémantique Manifest R8, collision R9, ordonnancement R10, cleanup R11, upgrade R12, Planner R13).
- **Spike T-ADR-0006** : périmètre étendu à R8-R13 (prototypes sémantique Manifest, collisions, Planner, contrat d'upgrade R12) ; validation porte sur R1-R13.
- **Prochaine action inchangée :** Spike T-ADR-0006 → rédaction ADR-0006 avant toute implémentation Phase 0-7.

## 2026-08-06 — PRD-0006 V2.2 : sources de migrations (framework / applications, R7)

- **PRD-0006 → V2.2** : `.project/prd/PRD-0006-migrations-engine.md` — extension du modèle à deux sources de migrations :
  - **R7 — `MigrationProvider` comme concept de premier ordre** : `ownerId()` + `migrations()` ; le Global Registry agrège les providers (Framework + Application) ; le moteur reste unique et **agnostique à l'origine** ;
  - **namespace obligatoire** `owner.module.version.sequence_name` (ex. `framework.database.v1.001_create_migrations`, `identity.users.v1.001_create_users`) — empêche les collisions entre sources ;
  - **Store conserve l'origine** (`owner` dans `ExecutedMigration` + table `mosaix_migrations`) — upgrades framework, install/uninstall d'applications, audit, détection de conflits ;
  - **cycle de vie des sources** : install / upgrade / uninstall (cleanup migrations) ;
  - **rollback ≠ uninstall** : `down()` reste une opération de développement (retour de batch), jamais un mécanisme de désinstallation.
- **ADR-0006 (Annexe A)** : 13 décisions à figer (9 précédentes + 4 nouvelles : moteur agnostique aux sources, namespace par owner, Store avec origine, rollback ≠ uninstall).
- **Prochaine action inchangée :** Spike T-ADR-0006 → rédaction ADR-0006 avant toute implémentation Phase 0-7.

## 2026-08-06 — PRD-0006 Migration Engine enregistré (V2.1) + analyse de faisabilité + Spike/ADR-0006

- **PRD-0006 enregistré** : `.project/prd/PRD-0006-migrations-engine.md` (V2.1) — nouvelle arborescence `.project/prd/` pour les documents de produit.
- **Analyse de faisabilité** : `.project/reports/feasibility-prd-0006-2026-08-06.md` — **GO conditionnel**, score 35/45, aucun conflit avec ADR-0001/0002/0003 ni la Constitution ; 4 décisions bloquantes identifiées.
- **Décisions intégrées en V2.1 (R1-R6)** :
  - **R1** — suppression de `@mosaix/manifest` : le Manifest applicatif existant (`ApplicationManifest` dans `@mosaix/contracts`, validation `@mosaix/schemas`) est la source unique de découverte des migrations ;
  - **R2** — checksum calculé au **chargement** (plus jamais à la génération) ;
  - **R3** — `MigrationLock` étendu avec `LockCapabilities` (distributed/processSafe/runtimeSafe) ; la garantie de concurrence appartient à l'adaptateur (PostgreSQL advisory lock / SQLite Node `BEGIN EXCLUSIVE` / SQLite navigateur single-writer) ;
  - **R4** — abstraction driver interne `SQLiteDriver` (`better-sqlite3`, `sql.js`/`sqlite-wasm`, OPFS) ;
  - **R5** — migration présente dans le Store mais absente du Registry → `MigrationMissingError` bloquante ;
  - **R6** — convention de tri `module.version.sequence_name`, comparaison numérique.
- **Tâche Spike créée** : `.project/backlog/prd-0006-migrations-spike.md` — **T-ADR-0006** (Architecture Spike / ADR-0006) = prérequis P0 ; **aucune tâche Phase 0-7 créée** tant que R1-R6 ne sont pas clôturées.
- **Prochaine action :** rédiger ADR-0006 (décisions R1-R6) avant toute implémentation PRD-0006.

## 2026-08-06 — T-A6 terminé (Permission Registry = autorité exclusive d'octroi, ARCH-012)

- **Faille corrigée** : le SDK ne s'auto-octroie plus les permissions. `MosaixApp.register` n'appelle plus `kernel.grantPermissions` ; l'octroi vient désormais exclusivement du Control Plane via `KernelConfig.grants` (type `PermissionGrant`, appliqué à la construction du kernel dans `applyExternalGrants`).
- **`kernel.grantPermissions(appId, tenant)` supprimé** : ce chemin lisait le manifeste auto-déclaré — la source d'autorité est maintenant externe au manifeste applicatif.
- **Migration** : tests et démo migrés pour fournir les grants via `new RuntimeKernel({}, { config: { grants } })` — `kernel.test.ts` (2 nouveaux tests : grant config appliqué + no self-grant), `sdk/index.test.ts`, `apps/identity/src/index.test.ts`, `apps/identity/src/application/identity-capabilities.test.ts`, `apps/sales/src/index.test.ts`, `demo/identity-sales.ts`, `demo/identity-sales.test.ts`. Les tests core restants octroyaient déjà explicitement via `kernel.permissions.grant` (inchangés).
- **Documentation** : `apps/identity/README.md` — section octroi Control Plane (manifeste déclare, kernel octroie) + API de composition avec grants.
- **Validation** : `tsc --build` core/sdk/identity/sales ✅ (0 erreur), prettier ✅. eslint/vitest non exécutables (install pnpm bloqué) ; les fichiers de test modifiés passent le type-check (hors erreurs `vitest` pré-existantes non liées).
- **Gouvernance** : backlog audit T-A6 → 100%, dashboard → prochaine action **T-I1** (après install) / **T-A5 ou T-A3** (immédiat, localisé).

## 2026-08-06 — T-A2 terminé (isolation ESLint par BAC, ARCH-009)

- **ESLint** : tag générique `app` éclaté en `app-identity` (`apps/identity/**`) et `app-sales` (`apps/sales/**`) — chaque BAC n'autorise plus que ses propres sources, les imports inter-BAC sont bloqués par `eslint-plugin-boundaries` (Loi 1 enforceée). La couche `demo` autorise les deux BAC (composition).
- **Test cross-app déplacé** : `cross-app flow` extrait de `apps/identity/src/index.test.ts` (qui importait `createSalesApp`) vers `demo/identity-sales.test.ts` — la couche de composition est la seule autorisée à importer plusieurs BAC. `vitest.config.ts` étendu à `demo/**/*.test.ts`.
- **Validation** : `tsc --build apps/identity` + `apps/sales` ✅ (0 erreur), prettier ✅ sur tous les fichiers touchés. eslint/vitest non exécutables (install pnpm bloqué) — config vérifiée par lecture.
- **Gouvernance** : backlog audit T-A2 → 100%, dashboard → prochaine action **T-A6**.

## 2026-08-06 — T-A1 terminé (Port UserRepository dans le domaine, ARCH-001) + règle « pas de basename dupliqué »

- **Refactoring DIP** (délégué à subagent, validé) : port `UserRepository` extrait de `apps/identity/src/infrastructure/` vers `apps/identity/src/domain/user-repository.ts`. L'adaptateur `InMemoryUserRepository` (infrastructure) importe et implémente désormais le port du domaine ; `user-service.ts` et `index.ts` (import type) pointent vers le domaine.
- **Règle constitutionnelle ajoutée (AGENTS.md, Règles absolues)** : interdiction de dupliquer un basename de fichier (ex. `domain/user-repository.ts` ET `infrastructure/user-repository.ts`) — un port et son adaptateur portent des noms distincts. Appliquée immédiatement : adaptateur renommé `infrastructure/in-memory-user-repository.ts` (renommé via `git mv`, imports tests/index mis à jour).
- **Validation** : `tsc --build apps/identity` ✅ (0 erreur), `prettier --check` ✅, aucun doublon de basename dans les sources (hors convention `index.ts` par package). eslint/vitest non exécutables (install pnpm bloqué — cf. `risks/2026-08-06-pnpm-supply-chain.md`).
- **Gouvernance** : backlog audit T-A1 → 100%, dashboard → prochaine action **T-A2**.

## 2026-08-06 — Backlog Review (workflow `planning/backlog-review`)

- **Scores Decision Score appliqués** à tous les items ouverts (rapport `.project/reports/backlog-review-2026-08-06.md`).
- **Prochaine action désignée :** T-A1 (UserRepository DIP, score 31) → T-A2 (isolation ESLint) → T-A6 (self-grant) → T-I1 (composition runtime, après déblocage install).
- **T-15 clôturé** (workflows matérialisés — 23 fichiers vérifiés). **T-08/T-09 marqués candidats à l'archivage** (couverts par T-02 + ADR-0002/0003, kernel).
- **Priorités :** P1 T-A1/T-A2/T-A6/T-I1 ; P2 T-06/T-A5/T-A3/T-A4/T-04 ; P3 T-I3/T-03/T-A9/T-I4 ; P4 T-A7/T-I2 (bloqué)/T-05/T-A8.
- Dashboard, backlogs `phase-1-mvp-core`, `ports-adapters-audit`, `ports-adapters-foundation` mis à jour.

## 2026-08-06 — Socle Ports & Adapters : Phases 5, 6, 7 livrées et validées (207 tests)

- **Phase 5 — Messaging (a4cc9ef)** : ports `@mosaix/ports-event-store`, `@mosaix/ports-message-bus`, `@mosaix/ports-pubsub` (routage événementiel : append/readStream, bus in-process, pub/sub distribué à `queueGroup`) + adapters `@mosaix/adapter-messagebus-mosaix` (bus in-memory synchrone/async), `@mosaix/adapter-kafka` (KafkaJS), `@mosaix/adapter-rabbitmq` (amqplib, topologie fanout). Typisation stricte de l'API Promise amqplib (`ChannelModel`/`Channel`). +3 suites de tests → **200 tests**.
- **Phase 6 — Security (34cbad0)** : port `@mosaix/ports-crypto` (hash/encrypt/decrypt/sign/verify/randomBytes) + adapters `@mosaix/adapter-crypto-node` (`node:crypto` : AES-256-GCM, SHA-256, RSA) et `@mosaix/adapter-crypto-web` (Web Crypto API, import PEM, mapping Buffer↔Uint8Array pour BufferSource). +2 suites → **202 tests**.
- **Validation Phase 1-6 (23d0440)** : rapport d'implémentation final `.project/reports/mosaix-infrastructure-implementation-report.md`, justification de l'exclusion temporaire de la Phase 7, conformité ESLint-boundaries à 100% (`ports → contracts/types`, `adapters → ports`).
- **Phase 7 — Extensions (df226b5)** : ports `@mosaix/ports-search` (index/search/delete) et `@mosaix/ports-feature-flags` (isEnabled/getVariation) + adapters `search-memory`, `search-elasticsearch` (multi_match + filters), `featureflags-memory`, `featureflags-launchdarkly` (résolution `exactOptionalPropertyTypes`). Rapport mis à jour → **207 tests / 45 fichiers**, lint + prettier 100%.
- **Totaux réseau** : 18 ports, 27 adapters, 15 nouvelles project references (`tsconfig.build.json`), lockfile étendu (kafkajs, amqplib, @elastic/elasticsearch, launchdarkly-node-server-sdk).
- **Risque relevé** : `pnpm install` local bloqué par la policy supply-chain (`@aws-sdk/client-s3@3.1104.0` / `client-ses@3.1104.0` publiés dans la fenêtre `minimumReleaseAge`) — à re-vérifier après expiration du cutoff. Comptages tests non re-vérifiés en session (node_modules absent).

## 2026-08-05 — Doctrine architecturale : Constitution, Invariants, RFC Process, README

- **Architecture Constitution** (`.project/architecture/constitution.md`) : les 7 lois immuables de MosaiX (Apps jamais de communication directe, Everything is a Contract, Runtime = arbitre jamais acteur, Single Owner per Event, Manifest déclaratif, No Business Logic in Kernel, One Bounded Context = One App). Toute modification = RFC + consensus.
- **Invariants contractuels** :
  - `manifest-invariants.md` — immuable, déterministe, versionné, self-contained, déclaratif, source de vérité unique.
  - `capability-invariants.md` — sync/async explicite, signature stable, versionnée, idempotente si déclarée, jamais d'événement implicite, résolue par contrat jamais par app.
  - `event-invariants.md` — immutable, append-only, owned, replayable, deterministic, versioned, ordered, tenant-isolated, security-classified.
- **RFC Process** (`.project/workflows/architecture/rfc-process.md`) : flux Idea → RFC (7 jours discussion) → Prototype → ADR → Implémentation → Audit ; ajouté au catalogue workflows.
- **README** : invariant fondateur « The Runtime is an arbiter, never an actor » placé en tête du document.
- Roadmap enrichie (voir commit précédent) : risques 7–16 en invariants, Event Explorer, tiered API, fragmented manifests, contract versioning, domain catalog.

## 2026-08-05 — Identity Reference App + Event Payload Contracts (178 tests)

- **ADR-0003 — Event Payload Contracts (T-17 clôturé)** : validation du payload d'événement au publish (roadmap §4.1).
  - `EventSchemaEntry.payloadSchema?` + `PayloadValidator` (`{ safeParse }`, structurellement compatible Zod — le framework n'importe jamais Zod) ; `EventSchemaRegistry.validatePayload(envelope)` ; paramètre optionnel `payloadCheck?` sur `DomainEventBus.publish` (4e argument) — rejet `EventError` « Payload validation failed » après ownership, avant permission ; câblage dans le module `events`.
  - Tolérance backward-compatible : sans `payloadSchema` enregistré, le payload est accepté (comportement inchangé).
  - SDK : `MosaixApp.registerEventSchema(entry)` → `kernel.registerEventSchema({ ...entry, ownerApp: manifest.id })` (SDK-first). +8 tests.
- **T-19 — Identity Reference App** (`apps/identity`, `apps/sales`, `demo/`) :
  - **Domaine hexagonale** : `User` (id UUID v7, email normalisé unique, scrypt `node:crypto`), `UserService` (create/lookup/list/update/disable/authenticate, `now`/`idGenerator` injectables), `IdentityError` hiérarchie (codes sérialisables), port `UserRepository` + `InMemoryUserRepository`.
  - **Événements gouvernés** : `identity.user.created`/`.updated` = `{ user: UserSnapshot }`, `.disabled` = `{ userId, email, disabledAt }` — schémas Zod enregistrés (publish invalide rejeté), publication `security.pii: true`, `metadata.aggregate`, `correlationId` par invocation.
  - **Couche application** : `IdentityCapabilities` orchestre le service et publie les événements (publish **awaité**, jamais fire-and-forget).
  - **Manifest complet** : 6 capabilities (`user.create/lookup/list/update/disable`, `authentication.validate`), permissions capability/event/entity scope exact ; `createIdentityApp(kernel, tenant, options?)` ; `start.ts` exécutable.
  - **Sales refactoré** : `createSalesApp(kernel, tenant, options?)` + consumer async (lookup via `user.lookup` puis publication de `sales.order.created`, ordre garanti à la résolution du handler) — plus de fire-and-forget. `main()` conservé.
  - **Démo E2E** : `demo/identity-sales.ts` (kernel partagé, lifecycle complet, store affiché), scripts racine `pnpm demo` + `pnpm start:identity`, élément eslint `demo`.
  - **Hygiène build** : `exclude` des tests dans les tsconfig apps (gap S4), `@mosaix/core` ajouté en devDependency racine (résolution démo).
- **Validation** : `pnpm check` ✅ (build, lint, **178 tests** — 61 ajoutés, prettier) + démo E2E opérationnelle.
- **Docs** : `apps/identity/README.md`, ADR-0003, rapport d'analyse + plan d'implémentation (`.project/reports/`, `.project/working/`), dashboard/project_state/backlog à jour.
- **Backlog Phase 2** : storage persistant, adaptateur OTel, policy engine multi-tenant, graphe de dépendances entre apps, table de compatibilité explicite des événements, typed RPC des I/O de capabilities.

## 2026-08-03 — ADR-0002 : Kernel Module System, KernelContext, observabilité, erreurs, lifecycle avancé (117 tests)

- **Architecture — `RuntimeKernel` minimisé (ADR-0002)** :
  - Le noyau ne possède plus le backbone : `EventStore`, `PermissionRegistry`, `DomainEventBus`, `AuthorizationEngine`, `CapabilityRegistry` sont fournis par des **modules** installés via `kernel.install(module)` (`KernelModule { name, version, register(ctx), initialize?, shutdown? }`).
  - `KernelContext` stable et borné (`config`, `logger`, `metrics`, `tracer`, `apps`, `events`, `eventStore`, `eventSchemas`, `permissions`, `authorization`, `capabilities`) — les composants reçoivent le contexte au lieu du kernel (plus de dépendances circulaires, remplacement d'implémentation possible).
  - `kernel.start()` (initialize modules → bootstrap apps) et `kernel.stop()` (drain gracieux des apps → shutdown modules en ordre inverse).
  - **Backward-compat** : la facade `kernel.store/permissions/bus/authz/capabilities/eventSchemas` et `register/grantPermissions/executeCapability/...` est conservée — SDK et apps existants inchangés (58 tests existants verts).
- **Hiérarchie d'erreurs** : `KernelError` (code + details sérialisables) + `RegistrationError`, `LifecycleError`, `AuthorizationError`, `CapabilityError`, `EventError`, `ValidationError`, `ServiceNotInstalledError` ; `asKernelError()` normalise. Les erreurs internes ne sont plus des `Error` bruts.
- **Identités & traçabilité** : `ApplicationIdentity`, `CapabilityIdentity`, `ExecutionContext { actor, tenant, capability?, correlationId, timestamp }` ; `describeTenant()`.
- **Observabilité native** : `ConsoleLogger` (JSON structuré), `InMemoryMetrics` (compteurs + labels), `InMemoryTracer` (`KernelTrace { action, actor, durationMs, status, error? }`) — points d'intégration OTel (backlog).
- **Lifecycle avancé** : états `discovered→registered→ready→active→draining→disabled` + `failed` ; `isHealthy`/`isReady` ; `markRegistered()`, `markReady()`, `drain()`, `retry()` ; transitions invalides → `LifecycleError`. Flux par défaut inchangé.
- **Capability system (T-16)** : résolution versionnée `resolve(id, version?)`, `get(id, ownerApp?, version?)`, cycle de vie `deprecate/remove`, découverte `availableList/find/has`, hooks de validation. +12 tests.
- **Event system** : `EventStore.append` idempotent (déduplication par `envelope.id`), `DomainEventBus` retry + **dead-letter queue** (`setRetryPolicy`, `deadLetters()`, `flushDeadLetters()`), propagation `correlationId`/`causationId`, négociation de version (`EventSchemaRegistry.getCompatible`/`isVersionRegistered`). +8 tests.
- **Tests** : +59 → **117 verts**, dont 3 jeux d'**invariants** (aucune transition illégale, aucune capability exécutée sans permission, aucun événement non enregistré/étranger publié) pour la stabilité future du noyau.
- **Validation** : `pnpm check` ✅ (build, lint, 117 tests, prettier).
- **Backlog** : Phase 2 — validation payload événements (T-17 restant), module storage persistant, adaptateur OpenTelemetry, policy engine multi-tenant, graphe de dépendances entre apps.

## 2026-08-03 — T-18 : validation Zod des manifests au `kernel.register()` + enveloppe au publish

- **T-18 bouclé — `@mosaix/schemas` consommé par `@mosaix/core`** :
  - `core` ajoute la dépendance `@mosaix/schemas` (workspace + tsconfig reference) — premier consommateur runtime réel du Domain Contract Layer (ADR-0001).
  - `kernel.register()` valide `manifest` via `ApplicationManifestSchema` (Zod) et **rejette les manifests invalides** avec message détaillé (chemin + erreur) — version non semver, permission à scope wildcard, manifest sans `runtime.entrypoint` → rejet.
  - `DomainEventBus` branché sur le kernel : validation structurelle de l'enveloppe via `MosaixEventEnvelopeSchema` avant la vérification d'ownership existante.
- **Tests** : +4 (`kernel.test.ts` rejet version/perm/wildcard runtime, acceptation manifest valide). Total 62 tests verts (précédemment 58).
- **Validation** : `pnpm check` ✅ (build, lint, 62 tests, prettier).
- **Risques** : ajout de Zod au runtime core (pondéré) — accepté au backlog (ADR-0001 : schémas runtime séparés). Le `register()` rejetteormais les manifests invalides (changement de comportement — vérifié par tests).

## 2026-08-03 — Brancher apps+kernel (Audit A1/A2/A3/A5) + durcissement kernel

- **A1 (High) — apps branchées sur le `RuntimeKernel`** : `apps/identity` et `apps/sales` consomment désormais `MosaixApp.register({manifest, tenant}, kernel)` ; le backbone DIY (EventStore/PermissionRegistry/DomainEventBus instanciés dans les apps) est supprimé. Les apps exposent leurs capabilities via `app.provideCapability(...)`.
- **A2 (Medium) — manifest unifié dans `@mosaix/contracts`** : `ApplicationManifest` V2 (MosaixArtifactManifest racine : `domain`/`runtime`/`metadata`, `capabilities: CapabilityContract[]`, `permissions: PermissionContract[]`) est l'unique forme. `@mosaix/types` réduit aux primitives (TenantIdentity, enveloppe, grammaire permission, AppStatus) — les manifests contractuels legacy (CapabilityManifest/EventManifest/ExperienceManifest/ApplicationManifest/AppDescriptor) sont supprimés. `core`/`sdk`/`apps` importent depuis `@mosaix/contracts` ; `TenantIdentity` ajouté à l'index public de `contracts`. Dépendance `@mosaix/contracts` ajoutée à core/sdk/apps (tsconfig refs + eslint + vitest inchangés).
- **A3 (Low) — SDK attaché au kernel** : `MosaixApp.register(config, kernel)` (enregistrement manifest + `kernel.grantPermissions`) ; `publish`/`subscribe` via `kernel.bus`, `executeCapability`/`provideCapability` via kernel (Flow B). Suppression de l'injection directe `permissions`+`bus`.
- **A5 (Info) — `lifecycle.ts` éclaté** : `capability-registry.ts` + `event-schema-registry.ts` dédiés ; `lifecycle.ts` ne conserve que le `AppLifecycle`.
- **Review runtime intégrée** : `AppLifecycle` transformé en **machine à états stricte** (transitions valides, historique `events()`, auto-degradation sur échec d'initialisation — plus jamais d'état bloqué à `initializing`) ; le kernel ajoute `grantPermissions(appId, tenant)` et `registerCapabilityExecutor(capabilityId, executor)` ; `executeCapability` prédite la permission `${ownerApp}:${id}:execute:tenant` puis invoque l'exécuteur enregistré (provider manquant → erreur explicite).
- **Tests** : `kernel.test.ts` migré + 3 tests (grant, exécution Flow B, provider manquant, historique), `sdk/src/index.test.ts` ajouté (4 tests d'intégration A1+A3). Total 58 tests verts.
- **Gouvernance** : backlog T-11→T-14 clôturés, T-16/T-17/T-18 créés (résolution capabilities namespacée+versionnée, validation payload + compatibilité d'événements, validation Zod des manifests au kernel), ADR-0001 mis à jour, dashboard à jour.
- **Validation** : `pnpm check` ✅ (build, lint, 58 tests, prettier).

## 2026-08-03 — Analyse des gaps fonctionnels, structurels et architecturaux

- **AGENTS.md v1.4 → v1.5** : ajout de « gaps fonctionnels et structurels (intentionnel vs réel) » à l'analyse continue (Principe fondamental) ; sous-section « Gaps » dans la Phase 3 (Assess) — fonctionnels, structurels, architecturaux, chacun devenant une tâche backlog ; ligne « Gaps » ajoutée au Health Check périodique ; catalogue workflows enrichi de la catégorie `analysis`.
- **`.project/workflows/analysis/`** : 3 workflows créés — `functional-gap.md` (fonctionnalité promise vs livrée/testée), `structural-gap.md` (architecture documentée vs structure réelle du code), `architectural-gap.md` (conformité aux ADR/principes vs implémentation).
- **Objectif** : mesurer et réduire l'écart entre le déclaré et le réel, à chaque fin de milestone/phase et lors des audits de santé.

## 2026-08-03 — T-10 : Domain Contract Layer (`@mosaix/contracts`)

- **`@mosaix/contracts`** : nouveau package — ABI layer de la plateforme. Contient `MosaixArtifactManifest` (racine commune), `ApplicationManifest`, `PluginManifest`, `ThemeManifest`, contracts capability/experience/theme/events/security, et `CONTRACT_VERSION`. Uniquement types/interfaces/enums — aucune logique métier, aucun code runtime, aucune dépendance UI.
- **`@mosaix/schemas`** : nouveau package — valideurs Zod des contracts (manifestes application/theme, enveloppe d'événement, grammaire de permission avec scope exact-match). Séparé de `contracts` pour ne pas imposer Zod aux consommateurs de types.
- **Principe roadmap #18** : « Everything is a Contract » — applications, plugins, themes, capabilities, experiences et events sont des contrats gouvernés, pas des détails d'implémentation.
- **Architecture** : direction des dépendances `types → contracts → schemas → core → sdk → apps` ; règles `eslint-plugin-boundaries` étendues ; ADR-0001 créé.
- **Tests** : +12 (schémas valides/invalides, version contracts), total 43.
- **Validation** : build, lint, 43 tests, prettier ✅.
- **Commits** : à définir.
- **Prochaine étape** : migrer les types contractuels de `@mosaix/types` vers `@mosaix/contracts`, puis consommation par core/sdk/apps.

## 2026-08-03 — Couche opérationnelle : workflows déclenchables

- **AGENTS.md v1.4** : section « Constitution et procédures opérationnelles » ajoutée — séparation explicite entre la constitution (principes permanents) et les workflows opérationnels. Format canonique, invocation `/workflow <categorie> <nom>`, catalogue, cycle de vie des workflows, session nominale. Structure `.project/` en Phase 1 enrichie de `workflows/`.
- **`.project/workflows/`** : 17 workflows créés + template canonique (`_template.md`) + catalogue (`README.md`) — agent (session-start/end), audit (repository-health, architecture, security, technical-debt), maintenance (fix, refactor), improvement (code-quality, performance), testing (test-gap-analysis), documentation (sync), architecture (adr-create), planning (backlog-review), release (release-readiness), recovery (incident-response), project (memory-cleanup).
- **Objectif** : ajouter des comportements récurrents sans modifier la gouvernance centrale ; exécuter chaque mission à hauteur du risque (Proportional Process).

## 2026-08-03 — Initialisation

- Création d'AGENTS.md (Autonomous Engineering Steward Protocol v1.3).
- Ajout de la roadmap stratégique MosaiX (roadmap.md).
- Initialisation de la structure de gouvernance `.project/`.
- Aucune fonctionnalité implémentée.

## 2026-08-03 — Phase 1 Backlog + Git Init

- **Backlog Phase 1** : 7 tâches (T-01 à T-07) définies dans `.project/backlog/phase-1-mvp-core.md`.
- **Git** : dépôt initialisé, premier commit `a25ab8c` (gouvernance + roadmap + .gitignore).
- **Dérive corrigée** : absence de Git (risque infrastructure Health Check).
- **Prochaine tâche** : T-01 Fondations monorepo.

## 2026-08-03 — Roadmap enrichie (Domain Event Infrastructure & Permission Contract System)

- **Roadmap** : enrichissement de `.project/roadmap.md` avec une spécification complète du système de communication inter-applications et du modèle d'autorisation — Event Envelope standard, Event Schema Registry, Event Ownership/Versioning/Compatibility/Replay/Ordering/Idempotency, Tenant Isolation, Permission Model `domain:resource:action:scope`, Permission Registry (allow/deny/wildcard), Authorization Flows (publish/execute/command/query), extension du manifest (`permissions.provides/requires`).
- **Impact roadmap** : Phase 1 étendue à « Minimal Runtime Kernel + Communication Backbone » (Event Kernel, Event Envelope, Permission System, Event Schema Registry, Authorization Engine) ; Phase 3 renommée « Distributed Application Communication Layer » ; Phase 4 ajoute Permission Graph Visualization ; Phase 5 ajoute Third-Party Event Contracts et Marketplace Security Policies.
- **Guiding Principles** : 7 principes ajoutés (11-17) — communication gouvernée, events = facts, ownership unique, permissions explicites, tenant-aware, kernel comme point d'application.

## 2026-08-03 — Session Steward (alignement documentation)

- **Dérive corrigée — D1** : `roadmap.md` racine dupliquait la roadmap (2 sources de vérité). Converti en pointeur vers `.project/roadmap.md`.
- **Dérive corrigée — D2** : `.project/project_state.md` aligné sur la nouvelle architecture (Event Schema Registry, Permission Registry, Communication Backbone, Authorization Engine).
- **Dérive corrigée — D3** : `.project/dashboard.md` aligné (6 phases, backlog 9 tâches, vigilances T-08/T-09).
- **Dérive corrigée — D4** : backlog Phase 1 étendu (T-08 Event Envelope & Event Kernel, T-09 Permission System + Authorization Engine).
- **Dérive corrigée — D5** : T-07 (Git init) marqué 100% (déjà commité en `a25ab8c`).
- **Prochaine tâche** : T-01 Fondations monorepo.

## 2026-08-03 — AGENTS.md : Git Repository Stewardship

- **Protocole enrichi** : section "Git Repository Stewardship" ajoutée entre Phase 1 (Observe) et Phase 2 (Understand), incluant : Phase Git (Repository Awareness), Git Safety Rules, Commit Discipline, Conventional Commit Strategy, Commit Size Guidelines, Branch Strategy, Pull Request / Review Discipline, Git History as Knowledge (ADR), Before Merge Checklist, Release Management, Git Recovery Principle, Repository Integrity Rule, Git Session Report.
- **Principe final** actualisé : "gardien du repository, de son architecture et de son histoire".
- **Session Report** : bloc Git State ajouté au contenu obligatoire du rapport de session.

## 2026-08-03 — T-01 : Monorepo Foundations (code scaffold)

- **Structure workspace** : `packages/{types,core,sdk}` + `apps/{identity,sales}` créés.
- **Tooling** : pnpm workspaces (`pnpm-workspace.yaml`), TypeScript strict + project references (`tsconfig.build.json`), ESLint 9 flat config + `typescript-eslint` + `eslint-plugin-boundaries`, Prettier, Vitest 3.
- **Contenu initial** : `@mosaix/types` (event envelope, permission grammar, manifest contracts), `@mosaix/core` (CapabilityRegistry, EventSchemaRegistry, EventStore, DomainEventBus, PermissionRegistry, AuthorizationEngine, AppLifecycle), `@mosaix/sdk` (MosaixApp developer API), demo apps Identity/Sales.
- **Tests** : 17 tests couvrant permission grammar, registry allow/deny/wildcard, tenant/space isolation, event schema validation, lifecycle transitions.
- **Validation** : `tsc --build` ✅ | `eslint` ✅ | `vitest run` ✅ | `prettier --check` ✅.
- **Décision** : pnpm workspaces retenu (coherent avec `.gitignore` existant, performance supérieure à npm workspaces). Segment-based permission matching retenu (wildcards par segment, scope toujours exact match).
- **Commits** : `5ed8aa6 feat(monorepo): scaffold pnpm workspace foundation` + `ff41470 docs(project): mark T-01 complete and update governance state`.
- **Prochaine tâche** : T-02 MosaiX Runtime Kernel.

## 2026-08-03 — Fix tooling + CI/CD

- **Dérive corrigée — D6 (tooling cassé)** : scripts `build`/`dev` référenciaient `tsgo` (binaire inexistant, on utilise `tsc`). Corrigé : `tsc --build` dans tous les packages, racine pointée sur `tsconfig.build.json` (aggregate project references).
- **Dérive corrigée — D7 (install en échec)** : `pnpm install` sortait avec code 1 (ERR_PNPM_IGNORED_BUILDS sur `esbuild@0.28.1`). Corrigé : `allowBuilds: esbuild: true` dans `pnpm-workspace.yaml`.
- **Dérive corrigée — D8 (formatage)** : `.prettierignore` ajouté (AGENTS.md, `.project/`, lockfile) pour ne pas auto-formater la mémoire projet.
- **CI/CD ajouté** : `.github/workflows/ci.yml` (GitHub Actions) exécute install + build + lint (inclut eslint-plugin-boundaries) + test + format sur push/PR. Script `pnpm check` = pipeline local complet.
- **T-06 progressé à 60%** : enforcement de direction de dépendances automatisé, CI prêt (activation requiert remote GitHub).
- **Commits** : `ac5dbef fix(monorepo): repair build tooling and esbuild approval` + CI commit.

## 2026-08-03 — T-02 : MosaiX Runtime Kernel

- **RuntimeKernel** (`packages/core/src/kernel.ts`) : backbone de communication partagé (EventStore, PermissionRegistry, DomainEventBus, AuthorizationEngine), enregistrement (`register(manifest, callbacks?)`), boucle de démarrage (`bootstrap()` → initializing → active, échec d'init → degraded avec containment), supervision (`degrade`, `disable`), découverte (`listApps`, `getStatus`, `has`), hooks kernel (onAppRegistered, onAppStateChanged, onBootstrapFailed).
- **AppLifecycle** : observateur `onStateChange` ajouté (transitions trackées).
- **Corrections backbone (bugs bloquants)** :
  - scope des permissions publish/consume `*:event:<type>:publish:*` → `…:tenant` (grammaire = scope exact-match, le `*` rendait toute publication impossible) ;
  - contrôle `consume` par abonné (`subscribe(type, handler, subscriber)`) et non plus par l'éditeur ;
  - `PermissionRegistry` : rejet des grants/denies à scope wildcard (`*`), conforme à la grammaire `tenant|organization|store|self`.
- **Tests** : +14 tests (`kernel.test.ts`), total 31 — registration/découverte, bootstrap + containment, supervision, authorization publish (scope exact-match), delivery per-subscriber, event store tenant-scopé, E2E event entre deux apps via le bus partagé.
- **Validation** : `pnpm check` ✅ (build, lint, 31 tests, format).
- **Commits** : T-02 (kernel + fixes backbone + tests).
- **Prochaine tâche** : raccorder la démo Identity→Sales au kernel partagé / T-03 Control Plane Registries.
## [2026-08-16] - Session Nettoyage & Consolidation Gouvernance .project/

### Added
- **Backlog Consolidé Unique** (`.project/backlog/consolidated-backlog-2026-08-16.md`) : Consolidation de tous les backlogs, working items, audits de santé, audit V2 ports & adapters et tickets `SEC-AUTH-001..010` en un document unique structuré par priorités (P0 à P3).
- **Dossier & Politique d'Archivage** (`.project/archive/README.md`) : Définition formelle des règles d'archivage et de conservation des invariants (ADR, PRD, Workflows, Rapports de vérité, Adapters orphelins).

### Changed
- **Dashboard & Project State** (`.project/dashboard.md`, `.project/project_state.md`) : Mis à jour avec le résumé des compteurs du backlog consolidé, les pointeurs vers les archives et les priorités d'exécution P0/P1.

### Archived
- Déplacement sous `.project/archive/` des working items complétés (`working/structural-gap-audit-2026-08-16.md`, `working/identity-reference-app-plan.md`, `working/T-02-runtime-kernel.md`, `working/T-01-monorepo-foundations.md`, `working/governance-questions.md`, `working/governance-execution-plan.md`, `working/delete-demo-sales-plan.md`) et du rapport v1 obsolète (`reports/audit-ports-adapters-2026-08-15.md`).
