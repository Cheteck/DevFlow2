# ADR-0002 — Kernel Module System & Kernel Context

- **Date :** 2026-08-03
- **Statut :** Accepted
- **Décideurs :** Architecture Steward
- **Lié à :** roadmap §17, §4 ; ADR-0001 ; T-16, T-17, T-18

## Context

Le noyau doit rester **petit et stable pendant des années** : le futur ajoute
des modules, des applications et des capacités, **mais ne modifie pas le noyau**.
Or `RuntimeKernel` (packages/core/src/kernel.ts) est aujourd'hui un point de
supervision centralisé qui possède directement le `EventStore`, le
`PermissionRegistry`, le `DomainEventBus`, l'`AuthorizationEngine` et les
registries `Capability`/`EventSchema`. Il est un *God Object* : toute évolution
future (nouveau stockage, policy engine, tracing distribué…) force une
modification du noyau → violation de la contrainte fondamentale.

De plus, les identités ne sont pas explicites (`TenantIdentity` seul), les
erreurs sont des `Error` à messages bruts, et aucune observabilité native
(logger structuré, metrics, traces) n'existe.

## Decision

### 1. Séparer Kernel Core et Kernel Modules

`RuntimeKernel` devient un **orchestrateur minimal** :

- installe des modules (`install(module)`),
- démarre (`start()`) et arrête (`stop()`) l'écosystème,
- résout les services via un **KernelContext** stable,
- applique les **frontières d'exécution** (authN→authZ→execution, jamais de raccourci).

La logique métier vit dans des **modules** enregistrés :

- `events` (EventStore, DomainEventBus, EventSchemaRegistry),
- `permissions` (PermissionRegistry + AuthorizationEngine),
- `capabilities` (CapabilityRegistry),
- `storage` (EventStore backend — aujourd'hui in-memory),
- `telemetry` (logger, metrics, traces),
- `config`, `scheduling`, `queues`, `caching`… ajoutés par le futur **sans toucher au noyau**.

### 2. `KernelModule` — contrat d'extension stable

```ts
interface KernelModule {
  name: string;
  version: string;
  register(ctx: KernelContext): void;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

Un module **déclare des services** (`provides`) et **consomme** des services via
le contexte. Le kernel n'importe jamais les implémentations : il n'installe que
des `KernelModule`.

### 3. `KernelContext` — service locator typé et borné

```ts
interface KernelContext {
  config: KernelConfig;
  logger: Logger;
  metrics: Metrics;
  tracer: Tracer;
  apps: AppRegistry;                 // manifests + lifecycle
  events: EventService;              // module events
  permissions: PermissionService;    // module permissions
  capabilities: CapabilityService;   // module capabilities
  storage: StorageService;           // module storage
}
```

Chaque composant reçoit le **contexte** au lieu de dépendre du `RuntimeKernel` :
cela supprime les dépendances circulaires et permet le remplacement
d'implémentations (in-memory → production) sans modifier les consommateurs.

#### Amendement (2026-08-10, T-EXT-01/T-EXT-02) — registre de services extensible

L'union fermée `KernelServices` est ouverte : le contexte s'appuie sur un
`Map<string, unknown>` interne ; les **6 services canoniques** restent typés via
`KernelServiceName` (`KERNEL_SERVICE_NAMES` exporté) et exposés par les getters
existants inchangés. Un `KernelModule` peut **fournir** (`ctx.setService`) et
**consommer** (`ctx.getService<T>(name)`) un nouveau domaine de service sans
éditer `@mosaix/core` (service canonique absent → `ServiceNotInstalledError` ;
extension absente → `undefined` ; double fourniture → `RegistrationError`).
L'observabilité (`logger`/`metrics`/`tracer`) est fournie par un
`ObservabilityModule` seedé **avant** les autres modules ; la substitution
passe par `KernelOptions.observability` (défauts `ConsoleLogger`/`InMemory*`
préservés, module non tracé dans `listModules()`). Ce registre reste un service
locator borné, **pas** un conteneur DI (rôle distinct, D2).

### 4. Backward compatibility (pas de migration cassante)

L'API publique actuelle reste disponible sur `RuntimeKernel` comme **facade
déléguée** vers les modules : `kernel.bus`, `kernel.permissions`,
`kernel.authz`, `kernel.capabilities`, `kernel.eventSchemas`, `kernel.store`.
`kernel.register(manifest)`, `bootstrap()`, `executeCapability()` etc. sont
conservés. Le SDK et les apps existantes continuent de fonctionner sans
modification. Les futures évolutions utiliseront le contexte, pas la facade.

### 5. Identités explicites & traçabilité

Chaque action est traçable via un `ExecutionContext` :

```ts
interface ExecutionContext {
  actor: ApplicationIdentity;      // { appId, version }
  tenant: TenantIdentity;
  capability?: CapabilityIdentity; // { id, version }
  correlationId: string;
  timestamp: number;
}
```

### 6. Hiérarchie d'erreurs stable

`KernelError` (sérialisable, `code`, `details`) est la racine. Sous-classes :
`RegistrationError`, `LifecycleError`, `AuthorizationError`, `CapabilityError`,
`EventError`, `ValidationError`, `ServiceNotInstalledError`. L'API ne jette plus
d'`Error` bruts internes.

### 7. Observabilité native

Logger structuré (levels, champs), Metrics (compteurs/horodatages), et
`KernelTrace { action, actor, duration, status, error? }` pour auditer chaque
appel. Points d'intégration OpenTelemetry définis (interfaces), implémentation
OTel différée en backlog.

## Consequences

### Positive

- Le noyau devient petit, stable, testable — **critère de réussite 1-2**.
- Les évolutions futures = **nouveaux modules / contrats / apps**, jamais de
  modifications du noyau — **critère de réussite 5-6**.
- Remplacement du stockage, de la politique, du tracing sans toucher aux
  consommateurs.
- Traçabilité complète des actions (audit).

### Negative

- Une indirection supplémentaire (contexte) — compensée par la stabilité acquise.
- Nécessite de migrer les registries actuels vers des modules en interne
  (facade conserve l'API publique).

### Risks

- **Désalignement d'interfaces** entre kernel, modules et contexte → mitigation :
  interfaces figées dans cet ADR, un seul ordre de construction
  (kernel → modules → apps), tests d'intégration de bootstrap complet.
- **Régression de l'API publique** → mitigation : facade déléguée + les 58 tests
  existants restent verts.
- **Modules trop couplés au kernel** → mitigation : les modules ne reçoivent que
  le contexte, jamais le kernel.

## Alternatives considered

1. **Garder le kernel centralisé** — rejeté : God Object, toute évolution
   modifie le noyau (violation du critère central).
2. **CQRS/ports & adapters complet dès maintenant** — rejeté : sur-ingénierie
   pour la taille actuelle ; le module system suffit, les ports seront ajoutés
   par les modules futurs.
