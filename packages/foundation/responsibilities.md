# Responsabilites — foundation

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/foundation` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Socle de bootstrap applicatif : classe Application et ServiceProvider de base, cycle register/boot standardise pour les BACs.

## Responsabilites

- Socle de bootstrap applicatif : classe Application et ServiceProvider de base, cycle register/boot standardise pour les BACs.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

container ; consomme par apps via heritage.

## Frontieres

- Aucun domaine metier concret.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
