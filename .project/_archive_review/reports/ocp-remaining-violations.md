# Rapport OCP — état après refactors (mise à jour)

Date : 2026-10-17
Périmètre : src/, apps/, packages/ (hors tests et node_modules)

## Violations traitées (TDD, commits atomiques)

1. `src/shell/renderer.ts` — switch `getCtaConfig(bacId)` → registre typé `ctaConfigFactories` + `registerCtaConfig` (commit `56cb01e`).
2. `src/shell/psp-webhook-handler.ts` — switch `event.type` → registre typé `pspEventHandlers` + `registerPspEventHandler`/`dispatchPspEvent` (commit `36313a2`).
3. `src/server/middleware/maintenance-gate.ts` — singleton `maintenanceService` → paramètre injectable (default singleton) (commit `14cd29f`).
4. `src/server/api-dispatcher.ts` — if-cascade systèmes (healthz/readyz/metrics/assetlinks/__mosaix) → `systemRouteRegistry` typé (commit `27a94f8`).

## Violations restantes

### A. Imports concrets dans le code métier — `src/server/api-dispatcher.ts:19-23`
- `ProposalService`, `PortfolioService`, `PostgresProposalRepository`, `PostgresVendableRepository` importés en dur.
- Couplage Shell → apps/portfolio + Postgres ; ajout d'un repository alternatif oblige à modifier le dispatcher.
- Refactoring proposé : injecter via `ApiDispatcherContext` (factory) ou résoudre depuis le Container ; le dispatcher ne connaît que des ports.
- Coût : moyen ; bénéfice : testabilité et DIP.

### B. Type guards / casts masquant des contrats — ~71 occurrences de `as`
- Majorité dans src/shell, src/server, apps. Beaucoup sont des casts `as UserProfile`, `as ThemeMode`, `as any` aux frontières HTTP/JSON.
- Signale des contrats implicites non déclarés (interfaces structurelles non nommées).
- Action : auditer au cas par cas ; remplacer par des type guards nommés ou des schémas de validation (zod) aux frontières.
- Priorité : frontières HTTP/JSON (parsedUrl, body) et accès aux registries.

### C. Registres orphelins / sur-design latent
- `SlotRegistry` (`packages/ui-runtime/src/index.ts:14`) : déclaré, 0 usage.
- `InMemoryGuard` (`packages/support/src/in-memory-guard.ts:6`) : 0 usage (aucun fallback InMemory restant).
- `PluginModule` : opt-in volontaire (testé) — pas une violation, mais `PluginRegistry` reste non câblé par défaut.
- Recommandation : soit câbler (SlotRegistry pour QR/FormHelp), soit retirer pour éviter la dette d'abstraction.

### D. ThemeRuntime hors Kernel — `src/shell/theme/theme-bridge.ts`
- Instancié en Shell, pas via `KernelModule`/`KernelContext`.
- Refactoring proposé : promouvoir en `ThemeModule` (wrapper) ; `ctx.getService("theme")`.
- Coût : faible ; bénéfice : cohérence avec les autres modules.

### E. Imports concrets dans d'autres modules (à auditer)
- À vérifier : `apps/*/src/infrastructure/*` qui instancient des repositories concrets sans port.
- Vérification manuelle requise par module.

## Ce qui respecte déjà l'OCP (à garder)
- `ApiRouteRegistry` + `systemRouteRegistry` (extension par enregistrement).
- `getCtaConfig` + `registerCtaConfig`.
- `dispatchPspEvent` + `registerPspEventHandler`.
- Capability/Event/Permission registries (kernel).
- `FeatureFlagsPort` + adapters hexagonaux.
- `DynamicBacRegistry` + `shellRegistry.registerNavigationItem` (manifest-driven).

## Priorité recommandée (prochaines sessions)
1. A — imports concrets dispatcher (injection via context/container).
2. D — ThemeRuntime → ThemeModule.
3. C — câbler ou retirer SlotRegistry/InMemoryGuard.
4. B — audit ciblé des `as` aux frontières HTTP.
5. E — audit par module des instanciations concrètes.