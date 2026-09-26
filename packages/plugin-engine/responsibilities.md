# Responsabilites — plugin-engine

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/plugin-engine` |
| Version | `0.1.0` |
| Couche | Plan controle & extension |

## Raison d'etre

Runtime et gestion des plugins : cycle DISCOVERED>VALIDATED>LOADED>INITIALIZED>ACTIVE>DISABLED>UNLOADED, sandbox isole, modele de capabilities plugin, adaptateurs, management service.

## Responsabilites

- Runtime et gestion des plugins : cycle DISCOVERED>VALIDATED>LOADED>INITIALIZED>ACTIVE>DISABLED>UNLOADED, sandbox isole, modele de capabilities plugin, adaptateurs, management service.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

contracts, types ; heberge plugins/*.

## Frontieres

- N'implemente aucun plugin metier.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
