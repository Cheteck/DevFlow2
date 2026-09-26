# Responsabilites — cache

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/cache` |
| Version | `1.0.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Facade Cache haut niveau orientee DX par-dessus CachePort (get/set/invalidate, TTL).

## Responsabilites

- Facade Cache haut niveau orientee DX par-dessus CachePort (get/set/invalidate, TTL).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports-cache ; consomme par apps.

## Frontieres

- Aucun backend integre (voir adapters cache-memory/redis).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
