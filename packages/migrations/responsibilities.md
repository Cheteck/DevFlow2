# Responsabilites — migrations

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/migrations` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Moteur de migrations : DSL SchemaBuilder, grammaires SQLite/Postgres, DAG tri topologique, preview SQL, dry-run, registre, runner, checksums, audit.

## Responsabilites

- Moteur de migrations : DSL SchemaBuilder, grammaires SQLite/Postgres, DAG tri topologique, preview SQL, dry-run, registre, runner, checksums, audit.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports-database ; consomme par CLI, control-plane/apps.

## Frontieres

- Ne contient aucune migration metier (elles vivent dans apps/adapters).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
