# Responsabilites — core

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/core` |
| Version | `0.1.0` |
| Couche | Noyau runtime (Layer 4) |

## Raison d'etre

RuntimeKernel : cycle de vie, registres (capabilities, events, theme targets), backbone de communication, ThemeResolver, decouverte/inventaire d'apps, isolation, ApplicationRuntime.

## Responsabilites

- RuntimeKernel : cycle de vie, registres (capabilities, events, theme targets), backbone de communication, ThemeResolver, decouverte/inventaire d'apps, isolation, ApplicationRuntime.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

contracts, schemas, types, config, container, http, ports-database ; consomme par sdk, gateway, mcp, apps.

## Frontieres

- Aucun acces infra direct hors ports ; aucune logique metier d'app.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
