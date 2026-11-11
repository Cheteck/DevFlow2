# Session 2026-10-18 — Registres OCP : fermeture du footgun + DRY contexte MCP

## Contexte
Suite au sprint OCP (`d10bd25` → `4ee6743`), deux points de finition restaient ouverts.

## Travaux réalisés

### 1. `packages/support/src/registry.ts` — `register()` ne peut plus contourner la garde
Avant : `register(key, value, allowOverwrite?)` + option `allowOverwrite` permettaient de réactiver
silencieusement l'écrasement (`register(k, v, true)`), annulant la protection introduite par `4ee6743`.
- Option `allowOverwrite` retirée de `TypedRegistryOptions`.
- 3e paramètre `allowOverwrite` retiré de `register()` (interface + implémentation).
- `clear()` retiré : API morte (aucun appelant sur un `TypedRegistry`), sémantique ambiguë vs
  `resetToDefaults()` (détruisait les defaults).
- Désormais `override()` est l'unique chemin de remplacement explicite.
- Vérifié : `allowOverwrite` n'apparaît plus nulle part ; les 5 `.clear()` du repo ciblent d'autres
  registres (provider-registry, FeedEngineRegistry, context-registry, capability-registry), pas `TypedRegistry`.

### 2. `packages/mcp/src/server/gateway.ts` — type de contexte partagé
Le type `{ principal?; authHeader?; [key: string]: unknown }` était dupliqué 4× (handler, port,
`resolvePrincipal`, `handleRequest`). Extraction de `McpGatewayCallContext` (exporté) et réutilisation aux 4 sites.

## Validation
- `vitest` ciblé : **59/59** (support, mcp, + 8 suites OCP).
- Suite complète : **1052 passed / 14 skipped**, inchangé (pas de régression).
- ESLint : 0 erreur sur les fichiers touchés.
- `tsc -p tsconfig.json` non exploitable : ~1490 erreurs pré-existantes (config racine multi-packages) —
  sans lien avec ces modifications ; aucune erreur ne cible `registry.ts`/`gateway.ts` édités.

## Complété dans la foulée : ThemeModule (fin d'un TDD spec-first)
`packages/core/src/modules/theme-module.test.ts` (non suivi, WIP d'une autre session) importait un
`./theme-module.js` inexistant, ce qui cassait la suite. Plutôt que le supprimer, le module a été
implémenté (`packages/core/src/modules/theme-module.ts`) sur le patron exact de `PluginModule` (ADR-0002) :
- `ThemeModule` expose `ThemeRuntime` sur `KernelContext` via `THEME_SERVICE` ("theme", service d'extension,
  pas un service canonique, absent de `defaultModules()`).
- Options : `runtime` (instance pré-construite), `registry`, `store` ; défaut = `ThemeTargetRegistry` vide +
  `InMemoryThemeAssignmentsStore` (opt-in documenté pour la règle no-restricted-syntax — défaut d'affichage, jamais de donnée métier).
- `getRuntime()` + `register(ctx)`.
- Export ajouté dans `packages/core/src/modules/index.ts`.
- Test nettoyé : `registry: {} as any` → `new ThemeTargetRegistry()`.

## Problèmes hors périmètre
- `tests/http/bac-access.http.test.ts` — échec **environnemental** (Docker `mosaix-db-1` down au premier run).
  Repassé **vert** une fois Postgres up : aucune action code requise.

## Validation finale
- Suite complète : **189/189 fichiers, 1070/1070 tests** (0 échec, 0 skip).

## Git State
- Commit `17a7446` : `refactor(ocp): make registry override explicit and share MCP call context`
  - `packages/support/src/registry.ts`, `packages/mcp/src/server/gateway.ts`.
- Commit `316cb45` : `feat(core): add ThemeModule exposing ThemeRuntime as kernel service`
  - `packages/core/src/modules/theme-module.ts` (nouveau), `theme-module.test.ts` (nouveau), `modules/index.ts`.
- Rollback : `git revert 316cb45 17a7446` (reverse-apply, ordre inverse) ou `git reset` sur les fichiers concernés.
