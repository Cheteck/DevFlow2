# Responsabilites — dev-session

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/dev-session` |
| Version | `0.1.0` |
| Couche | Outillage DX |

## Raison d'etre

Machine a etats de session dev + stores persistants (reprise de session).

## Responsabilites

- Machine a etats de session dev + stores persistants (reprise de session).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par dev-server/cli.

## Frontieres

- Jamais en production.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
