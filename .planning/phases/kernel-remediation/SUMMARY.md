# SUMMARY — kernel-remediation (Vague 1 + Vague 2)

## État
- Vague 1 (T1-T6) : **terminée** — `packages/core/src/kernel.ts` réécrit (orchestrateur ADR-0002, `KernelContext` unique, 7 états avec `STOPPING`, boundary capability complet, `mountRouter`/`getModuleHealth` réels).
- Vague 2 (T7-T12) : **terminée au niveau kernel + compat** — SDK vert, identity vert, conformance quasi-vert.

## Preuves
- `npx tsc --noEmit -p packages/core/tsconfig.json` → clean
- `vitest run kernel.test + kernel-module.test + event-bus + capability-registry + route-registry` → **97/97 verts** (avant : 30/38 échecs sur kernel.test seul)
- `sdk/src/index.test.ts` → 12/12 verts (grants Control Plane déjà supportés via `KernelConfig.grants`, T7 sans changement SDK requis)
- `apps/identity/src/index.test.ts` → 2/2 verts (fallback legacy T8)
- `packages/conformance` → 14/15 (1 échec pré-existant : `expected 8 to be 7`, hardcoded apps count, hors scope kernel)
- `apps/commerce` → manifest débloqué (1/6 → 2/6) ; 4 échecs restants `expected undefined to be 201/400/200/404` = bug `CommerceController` pré-existant, non-kernel

## Fichiers modifiés
- `packages/core/src/kernel.ts` (réécriture complète ~595L) : T1/T2/T3/T4/T5
- `packages/core/src/capability-registry.ts` : garde doublon `RegistrationError` + `resolve` déterministe + `CapabilityError` typés (T3)
- `packages/core/src/invariants.ts` : semver + `runtime.entrypoint` + `scope !== "*"` (T4)
- `packages/core/src/component-lifecycle.ts` : `@deprecated`, garde `ALLOWED` + `LifecycleError` (T4/T11)
- `packages/core/src/application-runtime.ts` : chaîne `VALIDATED→RESOLVED→LOADED→INITIALIZED→ACTIVE` (T11)
- `packages/core/src/kernel-module.ts` : message `installation incomplete` lowercase (T11 compat tests)
- `packages/core/src/index.ts` : export `KernelHooks` (T6)
- `packages/core/src/capability.ts` : `@deprecated` alias (T9)

## Décisions
- **T8 fallback legacy** : `kernel.register` accepte nouveau schéma Zod strict + legacy `canonical-app-schema` (permissions string[], `events[]` top-level, sans metadata). Sans ce fallback, les 8 apps auraient été rejetées en masse. Migration stricte repoussée en backlog (1 script `doctor:manifests` + 8 manifests).
- **T7 sans changement SDK** : `MosaixApp.register` + `new RuntimeKernel({}, {config:{grants}})` existants suffisent ; aucun `warn` ajouté (minimal change).
- **T10/T12 non modifiés** : `gateway` et `cli/dev-server` déjà ordonnés correctement (`mountRouter` après `initialize` dans les apps, pas de HMR `STOPPING` observé en test). Aucun changement pour éviter scope creep.
- **T9 alias conservé** : `capability.ts` singleton gardé avec `@deprecated`, removal v2.

## Répercussions résiduelles (backlog)
1. Migrer 8 manifests vers `ApplicationManifestSchema` strict + `pnpm doctor:manifests` pre-commit.
2. `CommerceController` retourne `undefined` status (4 tests) — hors kernel, à investiguer côté commerce.
3. `conformance/index.test.ts` hardcoded `7` apps → passer à dynamique `apps/*` count (beam = 8e app).
4. Supprimer `capability.ts` en v2 + codemod `ownerContext→ownerApp`.

## Rollback
Chaque fichier est revertable isolément (`git diff --stat` : 8 fichiers core). Aucune migration DB.
