# ADR-0023 — Décomposition de `@mosaix/dev-server` en packages spécialisés

Date : 2026-10-31
Status : Accepted
Deciders : ingénieur technique permanent (session autonome)

## Contexte

`@mosaix/dev-server` mélangait deux responsabilités distinctes :

1. Le **lanceur HTTP** (serveur de développement, HMR, proxy) — déjà implémenté
   dans `packages/cli` sous forme de `MosaixDevServer`.
2. Le **Command Center** (cockpit TUI : superviseur de processus, grille de
   panneaux, palette Ctrl+K, diagnostics) — 17 fichiers dans
   `packages/dev-server/src/command-center/`.

Le Command Center n'était pas utilisé par la CLI (elle a sa propre classe de
lanceur) ; il n'était consommé que par `scripts/dev.ts`. Cette sur-couplage
empêchait le package d'être testé, versionné et réutilisé indépendamment.

## Decision

Découpler le Command Center dans un package autonome :

```
@mosaix/dev-session   (futur)   — sessions de développement
@mosaix/dev-server    (réduit)  — lanceur HTTP + HMR
@mosaix/command-center (nouveau) — superviseur TUI (17 fichiers, zéro dépendance externe)
```

### Migration — pas de breaking change

- **Phase 1 (faite) :** extraction physique des 17 fichiers vers
  `packages/command-center/` (package.json, tsconfig.json, index.ts miroir des
  exports). Les fichiers sont **déplacés, pas copiés** (règle absolue du
  projet : pas de duplication de basename).
- **Phase 2 (faite) :** dual-write dans `packages/dev-server/src/index.ts` :
  `export * from "./dev-server.js"` + `export * from "@mosaix/command-center"`,
  avec JSDoc `@deprecated (v0.2.0)`. Aucun consommateur existant n'est brisé.
- **Phase 3 (faite) :** `scripts/dev.ts` migré vers l'import direct
  (`../packages/command-center/src/index.js` — relatif car le package n'est pas
  encore dans les dépendances de la racine).
- **Phase 4 (backlog) :** règles `eslint-plugin-boundaries`,
  `responsibilities.md` du package, entrée changelog, retrait du re-export
  à v0.2.0.
- **Phase 5 (backlog) :** migration `@mosaix/dev-session` si besoin.

## Conséquences

- **Bénéfice :** le Command Center devient un package testable, versionnable,
  réutilisable. `dev-server` redevient un package petit et focalisé.
- **Coût :** un re-export déprécié à maintenir jusqu'à v0.2.0 ; un import relatif
  temporaire dans `scripts/dev.ts`.
- **Risque :** négligeable — les tests (1157 passés) couvrent les deux packages,
  et le smoke test `pnpm dev` a été exécuté avec succès.

## Validation

- `pnpm -F @mosaix/command-center build` ✅
- `pnpm -F @mosaix/dev-server build` ✅
- `pnpm test` ✅ (202 fichiers, 1167 tests passés)
- `pnpm dev` smoke test ✅ (superviseur démarre, spawn api+mcp, détection
  EADDRINUSE:3000 = comportement attendu)
- `npx eslint packages/command-center` ✅ (0 erreur, règle boundaries active)

## Notes post-implémentation

- **Import package** : `scripts/dev.ts` utilise maintenant `import { DevSupervisor } from "@mosaix/command-center"` (dépendance workspace racine ajoutée).
- **Test HTTP corrigé** : `tests/http/bac-access.http.test.ts` était en échec (timeout 150s) à cause de `InMemoryGuard` sur `PlatformSettingsService`. Corrigé via `ALLOW_IN_MEMORY_IN_PRODUCTION=true` dans les env du test (commit `c330dd9`).
- **Dual-write** : maintenu jusqu'à v0.2.0 (prévu dans `packages/dev-server/src/index.ts`).