# Responsabilites — orm

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/orm` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

ORM multi-dialecte : QueryBuilder AST (SQLite/Postgres), Model, relations hasMany/belongsTo/manyToMany, Repository<T>, Seeder, Factory, cache de requetes, traits.

## Responsabilites

- ORM multi-dialecte : QueryBuilder AST (SQLite/Postgres), Model, relations hasMany/belongsTo/manyToMany, Repository<T>, Seeder, Factory, cache de requetes, traits.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports-database, types ; consomme par apps (infrastructure/), database.

## Frontieres

- Aucune connexion geree (voir DatabasePort/adapters).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
