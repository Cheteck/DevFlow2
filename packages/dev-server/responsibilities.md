# Responsabilites — dev-server

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/dev-server` |
| Version | `0.1.0` |
| Couche | Outillage DX |

## Raison d'etre

Serveur de developpement + runtime de session dev (reload, inspection).

## Responsabilites

- Serveur de developpement + runtime de session dev (reload, inspection).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par cli/scripts.

## Frontieres

- Jamais en production.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
