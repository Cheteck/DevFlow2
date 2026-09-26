# Responsabilites — database

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/database` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Resolution base multi-tenant : AppDatabaseResolver (persistent-first + fallback memoire), RLS Postgres, migrateur de schema BAC, grammaires.

## Responsabilites

- Resolution base multi-tenant : AppDatabaseResolver (persistent-first + fallback memoire), RLS Postgres, migrateur de schema BAC, grammaires.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports-database, orm ; consomme par apps.

## Frontieres

- Ne reimplemente pas les drivers (voir adapters database-*).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
