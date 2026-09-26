# Responsabilites — feed-engine

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/feed-engine` |
| Version | `0.1.0` |
| Couche | Moteur partage |

## Raison d'etre

Moteur de feed extensible partage : store de posts/activites, pipeline pub-sub + rendu, mutualise entre beam/solara.

## Responsabilites

- Moteur de feed extensible partage : store de posts/activites, pipeline pub-sub + rendu, mutualise entre beam/solara.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par apps beam/solara.

## Frontieres

- Aucune moderation (voir plugin solara-content-moderator).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
