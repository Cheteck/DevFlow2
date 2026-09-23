# Event Store Duality — MosaiX

**Version:** 1.0
**Status:** Accepted (note d'architecture, pas une Loi de la Constitution — révisable si la boundary évolue)
**Date:** 2026-08-11
**Ticket:** T-EXT-12 — Réconcilier `EventStore` du core et le port `event-store`
**Reference:** ADR-0002 (Kernel Module System), ADR-0003 (Event Payload Contracts), `event-invariants.md`, `ports-adapters-foundation.md` (T-I1 = T-EXT-05)

---

## Problème

Deux abstractions du même concept coexistent **sans lien**, et le port
`event-store` est le **seul port sans adapter** :

1. **`EventStore` du core** (`packages/core/src/event-bus.ts:24-65`) — journal
   **in-memory du bus interne**, scopé par **tenant**, synchrone, idempotent par
   `envelope.id`, sans `aggregateId` ni `expectedVersion`.
2. **`EventStorePort`** (`packages/ports/event-store/src/index.ts:15-25`) — port de
   **persistance d'événements de domaine / event sourcing**, asynchrone, organisé
   par **agrégat** (`aggregateType` + `aggregateId`), avec séquence et
   **`expectedVersion`** (concurrence optimiste).

Le README du port présente l'EventStore du kernel comme « candidate
implementation » (`packages/ports/event-store/README.md:52-54`) : cette promesse
est **irréalisable** avec les boundaries actuelles et doit être corrigée.

---

## Preuve (code : ligne)

| Fait | Preuve |
|---|---|
| `EventStore` tenant-scoped, sync, idempotent par id | `packages/core/src/event-bus.ts:24-47` (`append(envelope)`, clé tenant ; re-append → séquence existante) |
| `EventStore` requête par tenant (+ type), pas par agrégat | `packages/core/src/event-bus.ts:49-53` |
| `EventStorePort` append **par agrégat** + `expectedVersion`, async | `packages/ports/event-store/src/index.ts:15-22` |
| `EventStorePort` stream de lecture par agrégat | `packages/ports/event-store/src/index.ts:24` |
| **Adapters ne peuvent PAS dépendre du core** | `eslint.config.mjs:74-83` — allow `[adapters, ports, database-port, contracts, types]` ; core exclu → un `@mosaix/adapter-event-store-*` ne peut pas importer l'`EventStore` du kernel. |
| **Un sous-package de `packages/ports/**` ne peut pas non plus dépendre du core** | `eslint.config.mjs:73` — allow `[ports, contracts, types]`. |
| Core : dépendances déclarées = contracts/schemas/types uniquement, **aucun port** | `packages/core/package.json:21-25` |
| Doctrine vérifiée : le core ne connaît que la forme abstraite, jamais d'implémentation/adapter | `.project/reports/extensibility-audit-2026-08-11.md:87-91` (« zéro import d'adapters/ports/apps/frameworks », `core/package.json:21-25`) |
| Event store du kernel = partition par tenant (journal du bus) | `.project/architecture/event-invariants.md:82-84` |
| Event sourcing / reconstruction d'état = `metadata.aggregate(Id)`, contiguïté de séquence | `.project/architecture/event-invariants.md:95-98` |

---

## Décision

**Option (B) — Documenter la divergence ; faire du port une cible de la
composition (T-EXT-05).** Aucun adaptateur couplé à `@mosaix/core` n'est créé
aujourd'hui.

Justification structurelle (ordre de force décroissant) :

1. **Aucun adapter ne peut importer le core** (`eslint.config.mjs:74-83`) : un
   `@mosaix/adapter-event-store-kernel` qui adapterait l'`EventStore` du kernel
   violerait la boundary enforceée. Un sous-package `ports/**` non plus
   (`eslint.config.mjs:73`). → L'option (A 1:1) est **structurellement
   impossible** avec la boundary actuelle.
2. Même si `eslint.config.mjs:95-97` laisserait le core dépendre de `ports`,
   l'implémenter directement exigerait de changer l'API publique du store du
   kernel (sync/tenant/idempotent → async/aggregate/expectedVersion), soit un
   **breaking change** du `EventStore` du core (risque d'adaptation
   `expectedVersion` déjà signalé, `extensibility-audit-2026-08-11.md` → T-EXT-12)
   — refusé par la contrainte « ne pas casser la backward-compat ».
3. L'option (C) — dupliquer la logique d'un store in-memory dans un adapter pur
   `ports/adapters` sans dépendre du core — est **rejetée** : duplication,
   anti-pattern, contraire à « Minimal Sufficient Change ».

Distinction assumée (elle est **volontaire**, pas une dette) :

- `EventStore` du kernel = mécanisme **interne au bus** (routing / répercussion
  in-process d'enveloppes de domaine), partitionné par tenant, garantie
  d'idempotence par `envelope.id`. Il est le service canonique `eventStore` du
  kernel (`KernelServices`, `mosaix-packages-responsibilities.md:109`).
- `EventStorePort` = contrat **de persistance** pour l'event sourcing /
  append-only par agrégat avec contrôle d'expected version. Il est le port
  d'infrastructure à implémenter par un adaptateur dédié.

---

## Chemin prévu

1. **T-EXT-05 (= T-I1, composition adapters)** :
   - Créer dans la couche de composition (`@mosaix/composition` ou modules par
     domaine) un **adaptateur de port natif** qui implémente `EventStorePort`
     (in-memory avec `aggregateId` + `expectedVersion`, ou un stockage réel) —
     **sans** dépendre du core, comme tous les autres adapters.
   - Câbler cet adapter dans le registre de services ouvert (T-EXT-01) / services
     canoniques, en **préservant la backward-compat** du défaut in-memory du
     kernel.
   - Vérifier l'element `eslintBoundaries` du package de composition dans
     `tsconfig.build.json` (règle G4, `extensibility-improvement-2026-08-10.md`)
     avant le premier `pnpm check`.
2. **Backlog ports-adapters** : attribuer au port `event-store` un adaptateur
   autonome (`@mosaix/adapter-event-store-memory` a minima) pour fermer la liste
   des ports sans adapter.
3. **Si un jour le bus interne du kernel doit persister** (au-delà du journal
   en-mémoire) : le faire via le registre de services et un module de composition
   (ADR-0002) — **jamais** en important `ports` depuis `core/src/event-bus.ts`,
   ni en faisant pointer un adapter vers `@mosaix/core`. Path au moment de
   l'introduction d'un nouvel état du kernel construit sur le port.

---

## Impact

- **Code** : aucun changement de comportement. `packages/core/src/event-bus.ts`
  ne reçoit qu'une annotation croisée `@see` (aucun import ajouté, compat
  totale).
- **Port** : `packages/ports/event-store/README.md` corrigé — retrait de la
  fausse « candidate implementation », ajout d'une section Structure précisant
  la dualité et le chemin (T-EXT-05).
- **Boundary** : inchangée (aucune règle ESLint touchée). La note documente le
  fait que `eslint.config.mjs:95-97` laisse le core dépendre de `ports` **au
  niveau configuration**, mais que ni `core/package.json` ni la doctrine ne
  l'activent — toute activation future exigera un ADR.
- **Backlog** : le port `event-store` passe de « seul port sans adapter » à
  « port documenté, cible T-EXT-05 ».