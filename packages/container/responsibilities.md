# Responsabilites — container

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/container` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Conteneur IoC hierarchique : singleton/transient/scoped, child containers par tenant, binding contextuel, decorateurs, erreurs DI.

## Responsabilites

- Conteneur IoC hierarchique : singleton/transient/scoped, child containers par tenant, binding contextuel, decorateurs, erreurs DI.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par core, foundation, sdk, apps (ServiceProvider.register).

## Frontieres

- Aucune logique metier, aucun routage.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
