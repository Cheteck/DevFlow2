# Responsabilites — filesystem

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/filesystem` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Gestionnaire filesystem/storage ergonomique DX par-dessus StoragePort.

## Responsabilites

- Gestionnaire filesystem/storage ergonomique DX par-dessus StoragePort.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports-storage ; consomme par apps.

## Frontieres

- Aucun acces disque direct (delegue a l'adapter).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
