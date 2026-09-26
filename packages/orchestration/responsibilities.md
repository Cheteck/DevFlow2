# Responsabilites — orchestration

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/orchestration` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Moteur Saga/Workflow avec compensation : etapes, rollback, orchestration de checkout et processus longs.

## Responsabilites

- Moteur Saga/Workflow avec compensation : etapes, rollback, orchestration de checkout et processus longs.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par apps (workflows/) e.g. commerce.

## Frontieres

- Ni file de messages, ni cron (s'appuie sur events/message-bus).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
