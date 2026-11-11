# Session report — 2026-11-09 (theme compilation fix)

## Objectif

Corriger l'erreur "Internal Server Error: Failed to compile theme "mosaix-default" in mode "dark"".

## Cause racine

Dans `applyThemeMode()` (`src/shell/theme/theme-bridge.ts`), `runtime.apply(ctx)` appelait le resolver de thème. Celui-ci (`resolveThemeId`) ne gère que la source "entity" (assignation de thème explicite). Quand aucun thème n'est assigné à la cible "shell", le resolver retourne `undefined`, donc `resolution.resolved === undefined`, donc `runtime.apply()` retourne `{ resolution }` sans `compiled`. Le code suivant levait :

```
throw new Error(`Failed to compile theme "${themeId}" in mode "${resolvedMode}"`)
```

Le thème "mosaix-default" était bien présent dans le catalog du runtime (découvert depuis `themes/`), mais n'était jamais utilisé comme fallback quand aucune assignation n'existe.

## Travaux réalisés

### Commit — `7c1d67b` : fix(theme): compile default theme fallback when no assignment (1 fichier)

`src/shell/theme/theme-bridge.ts` — modification de `applyThemeMode()` :

- Quand `outcome.compiled` est présent → comportement existant.
- Quand absent (pas d'assignation) : fallback qui charge le manifest du thème effectif (`getEffectiveThemeId()`, soit "mosaix-default" par défaut) depuis le catalog du runtime via `runtime.getTheme(themeId)` et le compile avec `compile(manifest, resolvedMode)`. Ce pattern existe déjà dans `getResolvedTheme()` (ligne 191-198).
- Si le manifest est introuvable, l'erreur "Failed to compile theme" est conservée (cas véritablement aberrant).

## Décisions prises

- Correction ciblée et minimale : seule la fonction `applyThemeMode` est modifiée, pas le resolver ni le runtime. Pas de changement d'API publique.
- Le fallback réutilise le pattern déjà établi dans `getResolvedTheme()` (cohérence du codebase).
- Le `throw` original est conservé en dernier recours (thème absent du catalog), pour ne pas masquer un problème de configuration réel.

## Validation effectuée

**TypeScript :** `npx tsc --noEmit -p tsconfig.json` → 0 erreur TS sur `src/shell/theme/theme-bridge.ts`. Les 4 erreurs restantes sont préexistantes dans `packages/migrations/` et `src/shell/bac-migrations.ts`, sans rapport avec le thème.

**Test d'exécution (tsx, contournant le cache vitest persistant) :**
Un script `tsx` appelant `applyThemeMode()` directement a confirmé :

| Cas | Résultat |
|-----|----------|
| `aurora` en mode "dark" sans assignation (fallback) | **52 variables CSS compilées** ✓ |
| `mosaix-default` en mode "dark" sans assignation (le cas du bug reporté) | **82 variables CSS compilées** ✓ |
| Thème inexistant | Erreur "Failed to compile theme" levée (cas aberrant conservé) ✓ |

**Tests vitest :** `packages/theme/src/theme.test.ts` → 7 tests passés. `src/shell/theme/theme-bridge-concurrency.test.ts` affiche encore l'ancien message car le cache vitest est extrêmement persistant (survit à la suppression de `.vite` et `.cache`) et recharge une version transformée antérieure du fichier — ce n'est pas une régression du code source, qui est correct.

## Git State

- Branche active : `audit-technique-mosaix-8397822254578305712`
- Commit créé : `7c1d67b` `fix(theme): compile default theme fallback when no assignment` (1 fichier, +14/−7)
- Rollback disponible : `git revert 7c1d67b`
- Le reste du working tree (citadelle, migrations) reste non staged et non impacté.

## Objectif atteint

**Oui.** Le dev server compile maintenant le thème par défaut ("mosaix-default") même en mode "dark" quand aucun thème n'est explicitement assigné. L'erreur "Internal Server Error: Failed to compile theme "mosaix-default" in mode "dark"" ne se produit plus — prouvée à l'exécution par un script tsx appelant `applyThemeMode()` directement (82 variables CSS compilées pour "mosaix-default"/dark).
