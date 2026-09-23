---
phase: kernel-remediation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/kernel.ts
  - packages/core/src/kernel-module.ts
  - packages/core/src/capability-registry.ts
  - packages/core/src/capability.ts
  - packages/core/src/component-lifecycle.ts
  - packages/core/src/lifecycle.ts
  - packages/core/src/app-registry.ts
  - packages/core/src/event-bus.ts
  - packages/core/src/invariants.ts
  - packages/core/src/route-registry.ts
  - packages/core/src/index.ts
  - packages/contracts/src/runtime.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/mosaix-app.ts
  - apps/identity/src/index.ts
  - apps/commerce/src/index.ts
  - apps/spaces/src/index.ts
  - apps/solidarity/src/index.ts
  - apps/imperia/src/index.ts
  - apps/solara/src/index.ts
  - apps/portfolio/src/index.ts
  - apps/beam/src/index.ts
  - packages/core/src/application-runtime.ts
  - packages/conformance/src/suites/kernel.ts
  - packages/cli/src/dev-server/dev-server.ts
  - packages/gateway/src/index.ts
autonomous: false
requirements: [ADR-0002, ADR-0001, THEME-05]
must_haves:
  truths:
    - "KernelContext est unique (kernel-module.ts) — kernel.ts ne duplique plus le contexte et ne pré-instancie plus EventStore/Bus/Capabilities hors modules"
    - "Les registres ont une source de vérité unique : CapabilityRegistry canonique, AppLifecycle canonique — plus de split-brain bus/capabilities"
    - "EventBus branché sur PermissionRegistry.check, executeCapability vérifie permission + validateCapability/validateOutput + trace/metrics"
    - "Machine à états 7-états (CREATED→INITIALIZING→READY→RUNNING→STOPPING→STOPPED/FAILED) avec STOPPING émis et reboot depuis FAILED/STOPPED"
    - "getOrderedModules détecte les cycles et missing dependency via KernelLifecycleError, pas de récursion infinie"
    - "Invariants.manifest valide semver, runtime.entrypoint et scope exact-match avant register"
    - "mountRouter et getModuleHealth ne sont plus des stubs — router délègue à RouteRegistry, health reflète l'état réel des modules"
    - "SDK et apps migrés : grants Control Plane fournis via KernelConfig.grants, plus de publish/consume sans permission"
    - "Compat capability.ts : singleton déprécié conservé en alias, apps migrées vers CapabilityRegistry canonique"
    - "Conformance suite kernel mise à jour pour STOPPING et codes KernelError stables"
  artifacts:
    - path: "packages/core/src/kernel.ts"
      provides: "RuntimeKernel orchestrator minimal conforme ADR-0002, facade sur KernelContext"
      contains: "export class RuntimeKernel"
    - path: "packages/core/src/kernel-module.ts"
      provides: "KernelContext unique + KERNEL_SERVICE_NAMES + ServiceNotInstalledError agrégé"
      contains: "export class KernelContext"
    - path: "packages/core/src/capability-registry.ts"
      provides: "CapabilityRegistry canonique avec garde doublon et resolve déterministe"
      contains: "export class CapabilityRegistry"
  key_links:
    - from: "packages/core/src/kernel.ts"
      to: "packages/core/src/kernel-module.ts"
      via: "RuntimeKernel installe KernelContext unique, modules fournissent services via ctx.setService"
      pattern: "new KernelContext"
    - from: "packages/core/src/kernel.ts"
      to: "packages/core/src/event-bus.ts"
      via: "DomainEventBus construit avec permissionCheck = ctx.permissions.check, schemaCheck/payloadCheck depuis EventSchemaRegistry"
      pattern: "ctx.permissions.check"
    - from: "packages/core/src/kernel.ts"
      to: "packages/core/src/capability-registry.ts"
      via: "executeCapability → permissions.check + validateCapability + tracer.begin + metrics.increment"
      pattern: "capabilities.execute"
---

<objective>
Réparer le kernel hybride actuel (300L stub `kernel.ts:27 KernelContextImpl` dupliquant `kernel-module.ts:62 KernelContext`) qui provoque split-brain des registres, bypass sécurité (`DomainEventBus ()=>true`), stubs observabilité (`getModuleHealth` toujours OK, `mountRouter` noop) et machine à états incomplète (STOPPING jamais émis `contracts/runtime.ts:5`). L'objectif est de restaurer l'invariant ADR-0002 : noyau minimal orchestrator, modules fournisseurs de services, sans modifier l'API publique au-delà du strict nécessaire.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@packages/core/src/kernel.ts
@packages/core/src/kernel-module.ts
@packages/core/src/capability-registry.ts
@packages/core/src/capability.ts
@packages/core/src/lifecycle.ts
@packages/core/src/component-lifecycle.ts
@packages/core/src/event-bus.ts
@packages/core/src/invariants.ts
@packages/core/src/route-registry.ts
@packages/contracts/src/runtime.ts
@packages/core/src/modules/events-module.ts
@packages/core/src/modules/capabilities-module.ts
@packages/core/src/modules/permissions-module.ts
@packages/core/src/modules/observability-module.ts
</context>

## 1. Diagnostic — faits vérifiés (hors tests)

| # | Fichier:ligne | Incohérence | Sévérité |
|---|---------------|-------------|----------|
| K-01 | `kernel.ts:27` vs `kernel-module.ts:62` | Deux `KernelContext` ; fork utilise `getService("logging"/"tracing")` vs canon `"logger"/"tracer"` → observabilité toujours en échec | Critical |
| K-02 | `kernel.ts:47-50,103-108` | Pré-instanciation `EventStore/Bus/Capabilities` dans `KernelContextImpl` **et** dans `RuntimeKernel` → deux instances disjointes; modules écrivant `ctx.setService("events")` n'affectent pas `kernel.bus` | Critical |
| K-03 | `kernel.ts:48` | `new DomainEventBus(store, ()=>true)` neutralise `permissionCheck` `event-bus.ts:183` + `schemaCheck/payloadCheck` jamais branchés → isolation tenant fictive | Critical (sécurité) |
| K-04 | `kernel.ts:250` + `capability-registry.ts:153` | `executeCapability` ignore `callerApp/tenant`, n'appelle pas `PermissionRegistry.check` ni `validateCapability/validateOutput`, attache `executor` via `any` | Critical |
| K-05 | `capability-registry.ts:41,46` + `capability.ts:18` | Deux registres même nom; `register` écrase silencieusement, `resolve` scan O(n) non-déterministe | High |
| K-06 | `component-lifecycle.ts:38` vs `lifecycle.ts:43` | Deux automates; `transitionTo` sans garde `TRANSITIONS` | High |
| K-07 | `kernel.ts:259,261` | `mountRouter` noop, `getModuleHealth` toujours `OK` | Medium |
| K-08 | `kernel.ts:272` | `getOrderedModules` DFS sans détection cycle → stack overflow sur `A→B→A` | High |
| K-09 | `kernel.ts:103,183` | `STOPPING` `contracts/runtime.ts:10` jamais émis; `stop()` ignore `READY` | Medium |
| K-10 | `invariants.ts:10` | Seul `id` vérifié; `version` semver / `runtime.entrypoint` / `permissions.scope` non validés | Medium |

## 2. Périmètre

**Dans le scope (vague 1)**
- Unifier `KernelContext` (supprimer `KernelContextImpl`, garder `kernel-module.ts:62`)
- Faire de `RuntimeKernel` l'orchestrateur qui *installe* `ObservabilityModule` + `defaultModules()` et n'alloue plus de stores en propre
- Brancher `DomainEventBus` sur `ctx.permissions.check` + `EventSchemaRegistry.validateEnvelope/validatePayload`
- Restaurer `executeCapability` boundary : `check → validateInput → tracer → executor → validateOutput → metrics`
- Garde anti-doublon `CapabilityRegistry.register` + `resolve` déterministe (priorité `ownerApp:id` puis scan)
- Fusionner lifecycle : garder `lifecycle.ts:55 AppLifecycle`, déprécier `component-lifecycle.ts:26` (wrapper ou suppression)
- Corriger `getOrderedModules` avec `temp` set + `KernelLifecycleError` sur cycle/missing
- Étendre `Invariants.manifest` (semver `^\d+\.\d+\.\d+`, `runtime.entrypoint` requis, `scope !== "*"`)
- Implémenter `mountRouter→RouteRegistry.registerRoute` et `getModuleHealth` réel

**Hors scope (vagues suivantes)**
- Persistance `EventStore` (Redis/SQLite) — reste in-memory
- Distribution `RateLimiter` / HA Gateway (Phase 17)
- Vault/KMS (Phase 18)

## 3. Design cible

```typescript
// kernel.ts — orchestrator (ADR-0002)
export class RuntimeKernel {
  private readonly context: KernelContext; // unique, from kernel-module.ts
  private readonly stateMachine: KernelStateMachine; // 7 états contracts/runtime.ts:5
  private readonly modules = new Map<string, KernelModule>();

  constructor(config: KernelConfig = {}, opts:{modules?:KernelModule[], observability?}={}) {
    this.context = new KernelContext(config);
    new ObservabilityModule(opts.observability).register(this.context); // seed first
    (opts.modules ?? defaultModules()).forEach(m => this.install(m));
  }
  install(m: KernelModule) { /* guard duplicate + guard state !== running */ m.register(this.context); }
  async initialize() { /* CREATED|STOPPED|FAILED → INITIALIZING → topological boot → READY|FAILED */ }
  async start() { /* READY → RUNNING (+ bootstrap apps) ; CREATED → initialize → RUNNING */ }
  async stop()  { /* RUNNING|READY|FAILED → STOPPING → drain AppLifecycle → modules reverse → STOPPED */ }
  register(manifest: ApplicationManifest) { /* ApplicationManifestSchema.parse + apps.register + capabilities/eventSchemas */ }
  async executeCapability(id, caller, tenant, input) {
    // 1. permissions.check(`${owner}:${id}:execute:tenant`, tenant, caller) → AuthorizationError
    // 2. validateCapability(id,input) → CapabilityError
    // 3. tracer.begin("capability.execute") + metrics.increment
    // 4. executor(input) → validateOutput → trace.end(ok|error)
  }
  mountRouter(prefix, router) { router.routes.forEach(r=>this.context.routeRegistry.registerRoute(r)) }
}
```

`capability-registry.ts:41` devient :
```typescript
register(entry) {
  const key = `${entry.ownerApp}:${entry.id}`;
  if (this.capabilities.has(key)) throw new RegistrationError(`Capability already registered: ${key}`);
  this.capabilities.set(key, entry);
}
resolve(id, version?) {
  // 1. si version fournie → get exact ; sinon scan mais tri stable par ownerApp
}
```

## 4. Plan d'exécution — 6 tâches atomiques

### Tâche 1 — Unifier KernelContext & RuntimeKernel skeleton
**Fichiers:** `kernel.ts`, `kernel-module.ts`
- Supprimer `kernel.ts:27 KernelContextImpl` (47L)
- Importer `KernelContext, KERNEL_SERVICE_NAMES` depuis `kernel-module.ts`
- `RuntimeKernel` ne crée plus `EventStore/Bus`; `readonly context: KernelContext` unique
- `get stateMachineState` mappe `stateMachine.current` ; exposer `STOPPING`
- Vérif: `vitest run src/kernel.test.ts` passe de 30 échecs à compilation propre (tests outdated attendus → ne pas les prendre comme oracle)

### Tâche 2 — Branchage EventBus & permissions
**Fichiers:** `kernel.ts`, `modules/events-module.ts`
- `EventsModule.register` construit `DomainEventBus(store, (p,t,a)=>ctx.permissions.check(p,t,a), (e)=>schemas.validateEnvelope(e), (e)=>schemas.validatePayload(e))` `event-bus.ts:119`
- `RuntimeKernel` supprime `()=>true` `kernel.ts:48`
- `register(manifest)` filtre `manifest.permissions` pour ne pas self-grant (seuls `grants` `kernel-module.ts:20` Control Plane autorisent)
- Vérif: `pnpm check` type, `event-bus.test.ts` vert

### Tâche 3 — Restaurer capability boundary
**Fichiers:** `capability-registry.ts`, `kernel.ts`
- `register` garde doublon + `RegistrationError`
- `execute` signature `execute(id, caller, tenant, input, ctx)` vérifie `permissions.check`, `validateCapability`, `validateOutput`, lance `CapabilityError`/`AuthorizationError` typés `kernel-errors.ts:59,66`
- `registerCapabilityExecutor` throw si `!resolve` → `CapabilityError Unknown capability`
- `bindCapabilityContract` throw si `owner mismatch`
- Ajout `tracer.begin/metrics.increment` (observability)
- Vérif: boundary test manuel `execute without permission → AuthorizationError`

### Tâche 4 — Cycle, lifecycle & invariants
**Fichiers:** `kernel.ts`, `lifecycle.ts`, `component-lifecycle.ts`, `app-registry.ts`, `invariants.ts`
- `getOrderedModules` avec `visited/temp` + `KernelLifecycleError` sur `Circular dependency` `kernel.ts:272` (reprise `56b07b8` impl)
- `stop()` émet `STOPPING`, draine `AppLifecycle.drain()` `lifecycle.ts:140`, collecte `shutdownErrors`
- `component-lifecycle.ts` → déprécié : alias `export const runtimeLifecycleEngine = {register→AppLifecycle}` ou suppression + migration `application-runtime.ts:44`
- `Invariants.manifest` étendu : `semver`, `runtime.entrypoint`, `scope !== "*"` via `parsePermission` `@mosaix/types`
- Vérif: `lifecycle.test.ts` + `app-registry.test.ts` verts

### Tâche 5 — Router & health non-stub
**Fichiers:** `kernel.ts`, `route-registry.ts`
- `mountRouter(prefix, router: Router)` itère `router.listRoutes()` → `routeRegistry.registerRoute` `route-registry.ts:11` (propager `RegistrationError` sur conflit)
- `getModuleHealth()` agrège `module.health?.()` + `moduleHealth` map mise à jour en `initialize/start/stop`
- Vérif: `route-registry.test.ts` + manuel double mount même `GET:/spaces` → throw

### Tâche 6 — Barrel & contrats
**Fichiers:** `index.ts`, `contracts/runtime.ts`
- `index.ts` n'exporte plus `capabilityRegistry` singleton `capability.ts:53` (garder seul `CapabilityRegistry` canonique) — breaking change documenté
- Re-export `KernelStateMachine` types si besoin
- Vérif: `pnpm --filter @mosaix/core exec tsc --noEmit` clean, `pnpm build` vert

## 5. Répercussions sur le reste de la plateforme

### 5.1 Matrice d'impact

| Domaine | Packages / Apps touchés | Nature de la répercussion | Niveau | Action requise |
|---------|--------------------------|---------------------------|--------|----------------|
| **Core consumers** | `@mosaix/core` lui-même, `packages/conformance/src/suites/kernel.ts` | API `RuntimeKernel` redevient conforme ADR-0002 : `install`/`initialize`/`start`/`stop` avec `STOPPING`, `executeCapability` lance désormais `AuthorizationError` au lieu d'`Error` générique. Suites conformance doivent mettre à jour assertions `code` | High | Mettre à jour `conformance` suite kernel |
| **SDK** | `@mosaix/sdk` `MosaixApp.register` | `sdk/src/index.ts` déléguait à `kernel.register` + `kernel.bus` ; avec bus permissionné, les démos `identity→sales` échoueront sans `grants` explicites. `sdk` doit injecter `grants` via `new RuntimeKernel({}, {config:{grants}})` (pattern `56b07b8`) | High | Migrer `sdk` + démos |
| **Apps** | `apps/identity, commerce, spaces, solidarity, imperia, solara, portfolio, beam` | Chaque `createXApp(kernel)` enregistre `capabilities` + `domain.events`. Avec validation `Invariants` renforcée, manifests avec `version:"1.0"` ou `scope:"*"` seront rejetés au `register` (fail-fast). `spaces` et `commerce` déjà touchés par `tsconfig` modifs en cours | High | Corriger manifests invalides, ajouter `grants` Control Plane |
| **Events** | `@mosaix/events` `OutboxWorker`, `@mosaix/ports-event-store` | Dualité `EventStore` `event-bus.ts:31` (kernel) vs `EventStorePort` (domain) clarifiée `.project/architecture/event-store-duality.md` : kernel store reste in-memory, port reste aggregate. Aucun changement driver, mais `schemaCheck` désormais bloquant → events non déclarés rejetés (`EventError`) | Medium | Auditer publishers d'events non déclarés |
| **Capabilities** | `@mosaix/capability` consumers via `capability.ts` singleton | Suppression/alias du singleton `capabilityRegistry` `capability.ts:53` → imports `from "@mosaix/core/capability"` cassés. Migration vers `capability-registry.ts` canonique. `application-runtime.ts:50` doit migrer | High | Codemod `capabilityRegistry` → `CapabilityRegistry` |
| **Lifecycle** | `plugins/*`, `application-runtime.ts` | `RuntimeComponentLifecycleEngine` déprécié → plugins utilisant `runtimeLifecycleEngine.transitionTo` doivent passer par `AppLifecycle` (`lifecycle.ts:102 transition`). States `DISCOVERED→ACTIVE` mapés sur `discovered→initializing→active` | Medium | Wrapper compat ou migration plugins |
| **HTTP/Routing** | `@mosaix/http` `Router`, `packages/gateway`, `apps/*/infrastructure/*-controller.ts` | `mountRouter` désormais actif → conflits `GET:/path` détectés au boot (`RegistrationError`) au lieu de silencieux. Gateway doit ordonner `kernel.mountRouter("/api", router)` après `initialize` | Medium | Tester montages routes en intégration |
| **Observabilité** | `@mosaix/telemetry`, `packages/core/src/observability.ts` | `ctx.logger/metrics/tracer` seedés via `ObservabilityModule` `observability-module.ts:29` ; code lisant `container.resolve("logger")` reste OK mais direct field `kernel.bus` supprimé → lire `kernel.context.events` | Low | Vérifier `telemetry` n'accède plus à `kernel.bus` privé |
| **Theme System** | `packages/core/src/theme/*` (Phase 2-3) | `ThemeResolver` consomme `ThemeTargetRegistry`/`ThemeAssignmentsStore` via `KernelContext` ; pas d'impact direct mais `ThemeRuntime` bootstrap doit attendre `kernel.start()` pour que `eventSchemas` soient prêts | Low | Ordonnancer `ThemeRuntime` après `kernel.start()` |
| **Container/IoC** | `@mosaix/container` `Container` | `KernelContext.container` reste unique `kernel-module.ts:68`; `context.setService` fait `container.instance` `kernel-module.ts:132` → plus de divergence `services` vs `container` | Low | Aucun |
| **Infra adapters** | `packages/adapters/*`, `packages/migrations`, `InfrastructureModule` `modules/infrastructure-module.ts` | `InfrastructureModule` pourra enfin s'installer via `kernel.install` sans conflit `already registered` (garde corrigée). Débloque T-I1/T-EXT-05 restés en backlog | Medium | Réactiver `T-I1` |
| **CLI & Build** | `@mosaix/cli` `command-router.ts`, `scripts/build.ts` | CLI génère `server.js` qui `boot RuntimeKernel` `.project/architecture/mosaix-build-runtime-folder-spec.md:229` ; avec `STOPPING` et `initialize` strict, `mosaix dev --watch` doit gérer `stop→initialize→start` sur HMR | Medium | Mettre à jour `cli/dev-server` |
| **CI / Qualité** | `vitest.config.ts`, `.github/workflows/ci.yml`, `eslint` boundaries | `pnpm --filter @mosaix/core test` repassera vert après Tâche 6 ; boundaries `eslint-plugin-boundaries` déjà OK (dépendances `downward only` respectées) | Low | Ajouter gate `kernel.test.ts` non-outdated |
| **Docs & ADRs** | `.project/decisions/ADR-0002*`, `.planning/ROADMAP.md`, `FRAMEWORK.md` | ADR-0002 (kernel minimal) redevient vrai ; `ROADMAP Phase 1 Kernel Stabilization` repasse `100% COMPLETE` sans astérisque | Low | Mettre à jour `dashboard.md` |

### 5.2 Effets de bord temporels

1. **Boot plus strict → fail-fast au démarrage** : les 3 premières secondes de `kernel.start()` lèveront désormais sur manifest invalide ou route conflict, au lieu de laisser tourner un kernel à moitié configuré. Effet positif en prod, friction en dev (corriger vite les manifests).
2. **Event publish bloqué sans grant** : les flux cross-app `identity→sales` qui publiaient avec `()=>true` seront rejetés `EventError Permission denied` jusqu'à ce que `grants` Control Plane soient fournis. Prévoir migration `demo/identity-sales.ts` en même PR.
3. **Hot-reload** : `stop()` émet `STOPPING` puis `STOPPED` ; `dev-server` doit attendre `STOPPED` avant `initialize` (sinon `Cannot initialize from RUNNING`).

### 5.3 Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Breaking change `capability.ts` singleton supprimé | Haute | Build `apps/*` cassé | Tâche 6 fournit alias `export const capabilityRegistry = new CapabilityRegistry()` déprécié + codemod, removal en v2 |
| Manifests invalides rejetés en masse | Moyenne | `register` throw au boot | Linter `ApplicationManifestSchema` en pre-commit + script `pnpm doctor:manifests` |
| Cycle modules non détecté avant | Faible | Prod hang | Test `getOrderedModules` cycle `A→B→A` → `KernelLifecycleError` ajouté en Tâche 4 |
| Double EventStore oublié (code lisant `kernel.bus`) | Moyenne | Events perdus | Tâche 1 supprime `kernel.bus` privé, garde getter `get bus(){return context.events}` pour compat |
| Tests outdated pris comme oracle | Haute | Faux vert | Ne pas ajuster implémentation aux tests ; régénérer `kernel.test.ts` depuis spec `contracts/runtime.ts` en vague 2 |

### 5.4 Vérification (DoD)

- `pnpm --filter @mosaix/core exec tsc --noEmit` → clean
- `pnpm --filter @mosaix/core exec vitest run src/event-bus.test.ts src/capability-registry.test.ts src/lifecycle.test.ts src/route-registry.test.ts` → vert
- Manuel : `new RuntimeKernel().install(new EventsModule())` sans `PermissionsModule` → `ServiceNotInstalledError` agrégé `missingServices: [permissions, authorization]`
- Manuel : `kernel.executeCapability("nope", …)` → `CapabilityError code=CAPABILITY_ERROR`
- `grep -n "KernelContextImpl" packages/core/src` → 0
- `grep -n "capabilityRegistry" packages/core/src --include="*.ts" | grep "from.*capability$"` → 0

### 5.5 Rollback

Chaque tâche est committable isolément (`git revert <hash>`). Si Tâche 3 casse `apps`, revert Tâche 3 seule restaure le bypass permission (dégradation sécurité mais boot OK). Aucune migration DB.

## 6. Séquencement

```
VAGUE 1 — Noyau (1.5j)
Tâche 1 (skeleton) ─┬─→ Tâche 2 (events/permissions) ─→ Tâche 3 (capability boundary)
                    └─→ Tâche 4 (cycle/lifecycle) ─────┘
                                    ↓
                           Tâche 5 (router/health)
                                    ↓
                           Tâche 6 (barrel)

VAGUE 2 — Répercussions plateforme (1j) — NE DÉMARRE QU'APRÈS VAGUE 1 VERTE
Tâche 7 (SDK grants) ─┬─→ Tâche 8 (apps manifests) ─→ Tâche 10 (gateway)
                      ├─→ Tâche 9 (capability alias) ┘
                      └─→ Tâche 11 (conformance)
                                    ↓
                           Tâche 12 (CLI dev-server)
```

## 7. Implémentations de correction des répercussions (Vague 2)

Dépendances : Tâches 1-6 vertes (`pnpm --filter @mosaix/core exec tsc --noEmit` clean). Chaque tâche est committable isolément et possède son propre revert.

### Tâche 7 — SDK : brancher les grants Control Plane (répercussion High §5.1 SDK)
**Fichiers:** `packages/sdk/src/index.ts`, `packages/sdk/src/mosaix-app.ts`, `demo/identity-sales.ts`
**Problème:** Après T2, `DomainEventBus` exige `permissions.check("*:event:type:publish:tenant")`. Les démos et `MosaixApp` qui faisaient `new RuntimeKernel()` sans `grants` lèveront `EventError Permission denied`.
**Implémentation:**
```typescript
// sdk/src/mosaix-app.ts — avant
export class MosaixApp { constructor(private kernel: RuntimeKernel) {} register(manifest) { this.kernel.register(manifest); } }

// après — injecte grants Control Plane
export interface MosaixAppOptions { kernel: RuntimeKernel; grants?: PermissionGrant[]; }
export class MosaixApp {
  constructor(private kernel: RuntimeKernel, private opts: MosaixAppOptions) {
    // grants déjà appliqués au kernel via new RuntimeKernel({}, {config:{grants}})
  }
  static create(kernel: RuntimeKernel, manifest: ApplicationManifest, grants?: PermissionGrant[]) {
    // helper pour migrer les 4 BACs sans toucher chaque app
  }
}
// demo/identity-sales.ts — migration concrète
const kernel = new RuntimeKernel({}, {
  config: {
    grants: [
      { app: "identity", permission: "*:event:identity.user.created:publish:tenant", tenant: TENANT },
      { app: "sales",    permission: "*:event:identity.user.created:consume:tenant", tenant: TENANT },
      { app: "sales",    permission: "identity:user.lookup:execute:tenant", tenant: TENANT },
    ]
  }
});
```
- Ajouter `grants` param optionnel à `MosaixApp.register` pour rétro-compat : si absent, log `warn` en dev, pas de throw.
- Mettre à jour `sdk/index.test.ts` et `apps/identity/src/index.test.ts` pour fournir `grants` au kernel de test.
**Vérif:** `pnpm --filter @mosaix/sdk test` vert, `demo/identity-sales.test.ts` publie sans `Permission denied`.

### Tâche 8 — Apps : corriger manifests invalides (répercussion High §5.1 Apps)
**Fichiers:** `apps/*/src/index.ts` (8 apps), `apps/*/package.json` version, `packages/schemas/src/application.ts`
**Problème:** `Invariants.manifest` étendu T4 rejettera `version:"1.0"` (semver invalide), `runtime.entrypoint` manquant, `permissions: [{scope:"*"}]`.
**Implémentation:**
```typescript
// invariants.ts étendu — déjà fait en T4, ici on corrige les données
// Script de migration: apps/migrate-manifests.ts
for (const app of ["identity","commerce","spaces","solidarity","imperia","solara","portfolio","beam"]) {
  manifest.version = semverFix(manifest.version); // "1.0" → "1.0.0"
  manifest.runtime = manifest.runtime ?? { entrypoint: `/${app}.js`, isolation:"sandbox", engine:"web-worker" };
  manifest.permissions = manifest.permissions?.filter(p => p.scope !== "*"); // scope wildcard supprimé
}
```
- Corriger `apps/commerce/src/domain/order.service.ts` et `apps/spaces/src/domain/space.model.ts` si version hardcodée.
- Ajouter hook pre-commit `pnpm doctor:manifests` qui fait `ApplicationManifestSchema.safeParse` sur chaque `manifest.json`.
**Vérif:** `pnpm --filter @mosaix/schemas exec tsc` + `kernel.register` manuel avec ancien manifest → throw `Invalid application manifest`.

### Tâche 9 — Capability singleton : alias déprécié + codemod (répercussion High §5.1 Capabilities)
**Fichiers:** `packages/core/src/capability.ts`, `packages/core/src/index.ts`, `packages/core/src/application-runtime.ts`, `apps/*/src/**/*`
**Problème:** Suppression brutale de `capability.ts:53 capabilityRegistry` casse tous les imports `from "@mosaix/core/capability"` et `application-runtime.ts:50`.
**Implémentation:**
```typescript
// capability.ts — garder alias déprécié 1 version majeure
/** @deprecated Use CapabilityRegistry from "./capability-registry" — will be removed in v2 */
export const capabilityRegistry = new (await import("./capability-registry")).CapabilityRegistry();
// index.ts — réexport compat
export { capabilityRegistry as legacyCapabilityRegistry } from "./capability";
export { CapabilityRegistry } from "./capability-registry"; // canonique

// application-runtime.ts:50 — migration
- import { capabilityRegistry } from "./capability";
+ import { CapabilityRegistry } from "./capability-registry";
+ const capabilityRegistry = new CapabilityRegistry(); // injecté via KernelContext.capabilities à terme

// codemod pour apps/* :
// jscodeshift: capabilityRegistry.register({id, version, ownerContext}) → kernel.capabilities.register({id, version, ownerApp: ownerContext, entry, permissions})
```
- Ajouter `console.warn` sur `capabilityRegistry.register` en dev pour inciter migration.
**Vérif:** `grep -R "from.*capability\"$" apps/` → 0 après codemod, `pnpm build` vert avec alias.

### Tâche 10 — Gateway & routing : ordonner mountRouter (répercussion Medium §5.1 HTTP/Routing)
**Fichiers:** `packages/gateway/src/index.ts`, `apps/*/src/infrastructure/*-controller.ts`, `packages/core/src/route-registry.ts`
**Problème:** `mountRouter` actif T5 détectera les conflits `GET:/api/spaces` au boot → `RegistrationError` au lieu de silencieux, ordre mount important.
**Implémentation:**
```typescript
// gateway/src/index.ts — avant: mount avant initialize
kernel.mountRouter("/api", router); await kernel.initialize();

// après: mount après initialize, avant start
await kernel.initialize();
for (const app of apps) {
  const router = app.getRouter(); // expose via MosaixApp.getRouter()
  kernel.mountRouter(`/api/${app.id}`, router); // throw si conflit
}
await kernel.start();
```
- Controllers `imperia-controller.ts`, `space-controller.ts` doivent exposer `getRoutes(): RouteContract[]` au lieu de `registerRoutes(router)` direct.
**Vérif:** test intégration `gateway.test.ts` monte 2 apps avec même route → `RegistrationError: Route conflict`.

### Tâche 11 — Conformance & lifecycle compat (répercussion High/Medium §5.1)
**Fichiers:** `packages/conformance/src/suites/kernel.ts`, `packages/core/src/component-lifecycle.ts`, `plugins/*`
**Problème:** Suite conformance `kernel.ts` attend encore `kernel.bus` privé et codes `Error` génériques; `RuntimeComponentLifecycleEngine` déprécié casse plugins.
**Implémentation:**
```typescript
// conformance/src/suites/kernel.ts — maj assertions
- expect(() => kernel.bus.publish(...)).toThrow(/Permission denied/)
+ expect(() => kernel.context.events.publish(...)).toThrow(EventError)
+ expect(err.code).toBe("EVENT_ERROR") // KernelError stable

// kernel.test vague2: régénérer depuis contracts/runtime.ts:5
expect(kernel.stateMachineState).toBe("STOPPING") // après stop() avant STOPPED

// component-lifecycle.ts — wrapper compat
export const runtimeLifecycleEngine = {
  registerComponent(c: Omit<RuntimeComponent,"state">) {
    console.warn("[deprecated] runtimeLifecycleEngine → use AppLifecycle");
    const lifecycle = new AppLifecycle();
    // map DISCOVERED→discovered, ACTIVE→active
    return { id: c.id, state: lifecycle.status.toUpperCase() } as any;
  },
  transitionTo(id, state) { /* map vers lifecycle.transition */ }
};
```
**Vérif:** `pnpm --filter @mosaix/conformance test` vert, `plugins` build vert.

### Tâche 12 — CLI dev-server : gérer STOPPING (répercussion Medium §5.1 CLI)
**Fichiers:** `packages/cli/src/dev-server/dev-server.ts`, `packages/cli/src/command-router.ts`
**Problème:** HMR faisait `kernel.stop(); kernel.initialize();` sans attendre `STOPPED` → `Cannot initialize from STOPPING`.
**Implémentation:**
```typescript
// dev-server.ts — watcher HMR
async function hotReload(kernel: RuntimeKernel) {
  await kernel.stop(); // → STOPPING → STOPPED
  // attendre état STOPPED
  while (kernel.stateMachineState !== "STOPPED" && kernel.stateMachineState !== "FAILED") {
    await sleep(10);
  }
  await kernel.initialize(); // CREATED|STOPPED|FAILED → INITIALIZING
  await kernel.start();
}
```
- Mettre à jour `command-router.ts` `mosaix dev --watch` pour utiliser `hotReload`.
**Vérif:** `pnpm --filter @mosaix/cli test` + manuel `mosaix dev` modif fichier → reload sans throw.

### Matrice de dépendances Vague 2

| Tâche | Dépend de | Peut s'exécuter en parallèle avec |
|-------|-----------|-----------------------------------|
| T7 SDK grants | T2 (events permissionné) | T9 (capability alias) |
| T8 Apps manifests | T4 (invariants étendu) | T7, T9 |
| T9 Capability alias | T6 (barrel) | T7, T8 |
| T10 Gateway mount | T5 (router actif) | T7, T8 |
| T11 Conformance | T1-T6 | T10 |
| T12 CLI dev-server | T1 (STOPPING) | T11 |

**Coût Vague 2:** 1j (T7 0.25j, T8 0.25j, T9 0.15j, T10 0.15j, T11 0.1j, T12 0.1j). Vague 1+2 total 2.5j.

</objective>

<threat_model>

| Boundary | Description |
|----------|-------------|
| caller → register | `ApplicationManifest` non fiable, validation `Invariants` + `ApplicationManifestSchema` |
| caller → executeCapability | `callerApp/tenant/input` non fiables, check permission + contract |
| module → ctx.setService | `module.register` peut écraser service → `RegistrationError` |

| Threat | Cat | Mitigation |
|--------|-----|------------|
| T-K1 Tampering manifest invalide | Validation | `Invariants.manifest` étendu + `safeParse` |
| T-K2 Spoofing capability inconnue | Auth | `CapabilityError Unknown` + `AuthorizationError` |
| T-K3 DoS cycle modules | DoS | `KernelLifecycleError Circular` |
| T-K4 Info disclosure via health | Info | `getModuleHealth` ne leak pas `details` secrets |
</threat_model>

<testing_strategy>
- Unit : `capability-registry.test.ts` (garde doublon, resolve déterministe), `lifecycle.test.ts` (TRANSITIONS), `event-bus.test.ts` (permission deny), `route-registry.test.ts` (conflict), `invariants.test.ts` (semver/entrypoint/scope)
- Intégration : `kernel` boot `initialize→start→stop` avec `STOPPING` observable, `mountRouter` conflict → `RegistrationError`
- Pas de test `kernel.test.ts` legacy comme oracle — régénération prévue vague 2 depuis `contracts/runtime.ts`
</testing_strategy>

<verification>
- `pnpm --filter @mosaix/core exec tsc --noEmit`
- `pnpm --filter @mosaix/core exec vitest run src/event-bus.test.ts src/route-registry.test.ts`
- `grep -R "KernelContextImpl" packages/core/src` → 0
- `grep -R "capabilityRegistry" packages/core/src/index.ts` → alias déprécié seulement
</verification>

<success_criteria>
1. `KernelContext` unique, plus de split-brain bus/capabilities (T1)
2. `DomainEventBus` permissionné + `executeCapability` avec boundary complet (T2-T3)
3. Machine 7 états avec `STOPPING`, cycle détecté, `mountRouter`/`getModuleHealth` réels (T4-T5)
4. `pnpm build` vert, `pnpm check` sans `any` sur `executor` (T6)
5. Répercussions corrigées : SDK grants fournis (T7), manifests invalides rejetés/migrés (T8), alias capability.ts (T9) sans build cassé
6. Gateway mount ordonné après `initialize` sans `Route conflict` silencieux (T10)
7. Conformance suite verte avec codes `KernelError` stables et `STOPPING` observable (T11)
8. CLI HMR `stop→STOPPED→initialize` sans `Cannot initialize from STOPPING` (T12)
</success_criteria>

<output>
Après Vague 1, créer `.planning/phases/kernel-remediation/SUMMARY.md` + mettre à jour `.project/dashboard.md` (Kernel Stabilization → 100%).
Après Vague 2, créer `.planning/phases/kernel-remediation/SUMMARY-V2.md` listant SDK/apps/gateway/conformance migrés.
</output>
