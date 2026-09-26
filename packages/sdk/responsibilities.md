# Responsabilites — sdk

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/sdk` |
| Version | `0.1.0` |
| Couche | SDK (Layer 6) |

## Raison d'etre

DX applicative : classe MosaixApp (register/publishEvent/callCapability), helpers tenant/correlations, exposition unifiee core+http+orm+orchestration+flags.

## Responsabilites

- DX applicative : classe MosaixApp (register/publishEvent/callCapability), helpers tenant/correlations, exposition unifiee core+http+orm+orchestration+flags.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

config, contracts, container, core, http, orm, orchestration, ports-feature-flags ; consomme par apps.

## Frontieres

- Aucune infra propre ; ne remplace pas les ports.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
