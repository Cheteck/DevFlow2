# Rapport OCP — violations restantes (post-refactor renderer.ts)

Date : 2026-10-17
Périmètre : src/, apps/, packages/ (hors tests et node_modules)

## Violations restantes

### 1. Switch exhaustif sur union discriminée — `src/shell/psp-webhook-handler.ts:96`
- `switch (event.type)` sur `PspWebhookEvent.type` (union de 5 variants).
- Ajouter un variant PSP (ex. `charge.refunded`) oblige à modifier ce switch.
- Refactoring proposé : table de handlers typée `{ [K in PspWebhookEvent['type']]?: (event) => void }` + dispatch `handlers[event.type]?.(event)`, avec fallback `default` conservé.
- Coût : faible ; bénéfice : nouveaux types PSP sans toucher le handler.

### 2. If-cascade résiduelle — `src/server/api-dispatcher.ts` (healthz/readyz/metrics/assetlinks/__mosaix)
- 5 branches `if (pathname === ...)` avant la boucle registre.
- Ajouter un endpoint système oblige à modifier `dispatchApiRequest`.
- Refactoring proposé : enregistrer ces handlers dans `apiRouteRegistry` (ou un registre dédié `systemRouteRegistry`) avec priorité, comme les autres.
- Coût : faible ; risque : ordre d'exécution (probes avant auth) à préserver via priorité explicite.

### 3. Imports concrets dans le code métier — `src/server/api-dispatcher.ts:19-23`
- `ProposalService`, `PortfolioService`, `PostgresProposalRepository`, `PostgresVendableRepository` importés en dur dans le dispatcher (couplage Shell→apps/portfolio et → Postgres).
- Ajouter un repository alternatif oblige à modifier le dispatcher.
- Refactoring proposé : injecter via `ApiDispatcherContext` (factory) ou résoudre depuis le Container ; le dispatcher ne devrait connaître que des interfaces (ports).
- Coût : moyen ; bénéfice : testabilité et DIP.

### 4. Type guards / casts masquant des contrats
- ~71 occurrences de `as` dans src/apps/packages (hors tests). Beaucoup sont des casts `as UserProfile`, `as ThemeMode`, etc.
- Signale des contrats implicites non déclarés (interfaces structurelles non nommées).
- Action : auditer au cas par cas ; remplacer les `as` par des type guards nommés ou des schémas de validation (zod) aux frontières.
- Priorité : frontières HTTP/JSON (parsedUrl, body) et accès aux registries.

### 5. Singletons importés plutôt qu'injectés
- `src/server/middleware/maintenance-gate.ts:7` : `import { maintenanceService } from "@mosaix/core"` (singleton module-level).
- Testabilité limitée : le service ne peut pas être remplacé par un fake sans module mocking.
- Refactoring proposé : injecter via paramètre `handleMaintenanceGate(..., maintenanceService)` ou résoudre depuis le Container (déjà exposé par `MaintenanceModule`).
- Coût : faible.

### 6. Registres "fermés par erreur" / orphelins
- `PluginRegistry`, `SlotRegistry` déclarés mais non câblés (aucun usage réel) — abstraction sans second usage (sur-design latent).
- `InMemoryGuard` existe mais 0 usage — garde-fou non branché.
- Recommandation : soit câbler (PluginModule par défaut), soit retirer pour éviter la dette d'abstraction.

## Ce qui respecte déjà l'OCP (à garder)
- `ApiRouteRegistry` + `apiRouteRegistry.register(...)` (extension par enregistrement).
- `getCtaConfig` + `registerCtaConfig` (refactoré).
- Capability/Event/Permission registries (kernel) — extension sans modification Core.
- `FeatureFlagsPort` + adapters hexagonaux.

## Priorité recommandée
1. Table de handlers PSP (faible effort, gain clair).
2. Injection de `maintenanceService` (faible effort).
3. Retirer ou câbler les registres orphelins (clarification d'intention).
4. Audit ciblé des `as` aux frontières HTTP.