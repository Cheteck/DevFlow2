# Responsabilites — migrations

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/migrations` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Moteur de migrations inspire de Laravel, natif TypeScript : une migration est
un module (`up(context)` / `downMigration(context)`), jamais une chaine SQL.
DSL SchemaBuilder, grammaires SQLite/Postgres, DAG tri topologique, preview
SQL, dry-run, registre, planner (frontiere de compilation), runner, checksums
de source, audit.

## Responsabilites

- Moteur de migrations TypeScript natif : registre, planner (delta + compilation), runner, store, checksums, audit.
- Contract unique : seules les migrations TypeScript natives sont acceptees. La regle est **executee** a trois niveaux (`loadMigration`, `MigrationValidator`, `MigrationCompiler`) : les champs SQL legacy `content`/`down`/`kind` et l'echappement `rawSql`/`downRawSql` sont rejetes dans le code, pas seulement documentes.
- DSL de schema (`context.schema`) et API de donnees (`context.data`) : aucune migration ne porte de SQL brut.
- Une seule exception assumee et typee : `createFunction`/`createTrigger` declarent un corps PL/pgSQL (du code de fonction, jamais une commande SQL), PostgreSQL uniquement.
- Modele d'expressions structure et ferme (jamais de texte SQL libre) ; une seule notion de requete (`select` / `subquery`).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

- `ports-database` : depend du port `DatabasePort` uniquement.
- Consomme par : shell (`src/shell/migration-registry.ts`), CLI (`migrate*`), les 10 BACs (manifests de migrations).

## Frontieres

- Ne contient aucune migration metier (elles vivent dans apps/*).
- Ne depend d'aucun adaptateur : le dialecte vient du `DatabasePort` de l'appelant.
- Ne lit jamais le systeme de fichiers : la decouverte passe par les manifestes (R1).
- N'elargit pas le DSL sans decision d'architecture explicite.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).
- N'execute aucun SQL : le Runner execute les instructions compilees par le Planner.

## Criteres de sante

- [x] `src/index.ts` stable et documente.
- [x] Tests verts (`vitest run`).
- [x] Aucune dependance interdite par `eslint-plugin-boundaries`.
- [x] `pnpm check:migration-checksums` vert (aucune derive de checksum de migration).
- [x] `pnpm audit:migrations` vert : nullabilite, types, references de tables et equivalence SQL des migrations.
