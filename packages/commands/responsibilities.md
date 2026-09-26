# Responsabilites — commands

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/commands` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

CQRS : CommandBus, CommandHandler, primitives de commandes.

## Responsabilites

- CQRS : CommandBus, CommandHandler, primitives de commandes.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par apps (couche application/).

## Frontieres

- Aucun transport, aucune persistance.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
