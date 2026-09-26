# Responsabilites — pipeline

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/pipeline` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Helper d'execution sequentielle sync/async (middlewares, chaines de traitement).

## Responsabilites

- Helper d'execution sequentielle sync/async (middlewares, chaines de traitement).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par gateway, auth-pipeline.

## Frontieres

- Aucun IO, aucun ordonnancement distribue (voir orchestration).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
