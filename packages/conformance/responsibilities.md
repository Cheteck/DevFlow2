# Responsabilites — conformance

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/conformance` |
| Version | `0.1.0` |
| Couche | Outillage qualite |

## Raison d'etre

Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, utilises par `pnpm check`.

## Responsabilites

- Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, utilises par `pnpm check`.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par scripts/CI, templates d'apps.

## Frontieres

- Ne corrige rien, ne build rien.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
