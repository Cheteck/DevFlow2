# Responsabilites — support

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/support` |
| Version | `0.1.0` |
| Couche | Utilitaires |

## Raison d'etre

Helpers transverses : generation HTML, garde in-memory (InMemoryGuard) pour tests/dev.

## Responsabilites

- Helpers transverses : generation HTML, garde in-memory (InMemoryGuard) pour tests/dev.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

sans dependance ; consomme partout en tests.

## Frontieres

- Aucune logique metier.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
