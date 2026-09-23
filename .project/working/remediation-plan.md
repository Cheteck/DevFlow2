# Plan de Remédiation — MosaiX Platform

Date : 2026-09-20
Architecte : Autonomous Engineering Steward
Statut : En cours d'exécution

---

## 1. Vue d'Ensemble & Dépendances

```
┌─────────────────────────────────────────────────────────────┐
│ P0.1 : Fix imports manquants src/start.ts                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ P0.4 : Nettoyage imports dupliqués SDK dans apps             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ P0.5 : Règle grammaire 4-parties permissions (sécurité)      │
│ (parsePermission, Invariants.manifest, 8 apps)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ P0.2 : Alignement Contrat ApplicationManifest / Artifact     │
│ (Schemas, Contracts, Invariants, Kernel, 8 apps mosaix.json)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ P0.6 : Normalisation Tenant dans EventBus / EventStore       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ P0.3 : Création & validation tsconfig.build.json             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tableau des Tâches Détaillées

| ID | Priorité | Module / Fichiers | Description | Dépendances | Estimation |
|---|---|---|---|---|---|
| **P0.1** | P0 | `src/start.ts` | Import explicite `ThemeManifestSchema` (@mosaix/schemas) et `FeedPost` (`./shell/feed-store.js`) | Aucune | 5 min |
| **P0.4** | P0 | `apps/{solara,solidarity,spaces,booking}/src/index.ts` | Éliminer les imports dupliqués de `@mosaix/sdk` | Aucune | 5 min |
| **P0.5** | P0 | `packages/types`, `packages/core/invariants`, `apps/*/mosaix.json`, `apps/*/src/index.ts` | Forcer la grammaire 4-parties `domain:resource:action:scope` sans fallback implicite | Aucune | 15 min |
| **P0.2** | P0 | `packages/contracts`, `packages/schemas`, `packages/core/kernel.ts`, `apps/*/mosaix.json` | Aligner `ApplicationManifest` et `MosaixArtifactManifest`, supprimer code legacy / `as any` dans kernel | P0.5 | 25 min |
| **P0.6** | P0 | `packages/core/src/event-bus.ts`, `packages/ports/event-store` | Normaliser `envelope.tenant` (string -> `{ organizationId }`) et tests unitaires | Aucune | 10 min |
| **P0.3** | P0 | `tsconfig.build.json`, `scripts/build.ts` | Compléter et valider `tsconfig.build.json` pour compilation propre du monorepo | P0.1, P0.2 | 15 min |
| **P1.1** | P1 | `src/shell/discovery.ts`, `src/generated-bac-registry.ts` | Éliminer le couplage shell→apps via dynamic discovery | P0.2 | 30 min |
| **P1.2** | P1 | `packages/contracts`, `packages/core/theme` | Harmoniser `ThemeMode` avec `"high-contrast"` | P0.2 | 10 min |
| **P1.3** | P1 | `packages/core/src/application-runtime.ts` | Éliminer le système de composition mort (ou harmoniser avec RuntimeKernel) | P0.2 | 20 min |
| **P1.4** | P1 | `packages/core/src/modules/infrastructure-module.ts` | Typer `InfrastructureModuleOptions` proprement | Aucune | 10 min |
