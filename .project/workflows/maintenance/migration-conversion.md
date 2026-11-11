# Conversion d'une migration SQL historique vers le DSL TypeScript

- **Catégorie :** `maintenance`
- **Commande :** `/workflow maintenance migration-conversion`
- **Niveau de risque par défaut :** `high`
- **Chemin :** `.project/workflows/maintenance/migration-conversion.md`

## Purpose

Le moteur `@mosaix/migrations` n'accepte **que** des migrations TypeScript
natives : le SQL brut est refusé à trois niveaux (`loadMigration`,
`MigrationValidator`, `MigrationCompiler`). Ce workflow décrit la procédure
pour convertir une migration SQL historique vers le DSL — et, surtout, pour
**prouver** que le schéma généré reste identique à celui qui est déployé.

La conversion n'est pas un refactoring cosmétique : une divergence passe
inaperçue jusqu'à la production (colonne devenue `NOT NULL`, type changé,
clé étrangère sans schéma). Les audits de `scripts/migrations/` sont le garde-fou
qui rend la conversion sûre ; ce workflow est la procédure qui les enchaîne.

## Trigger

- Une migration doit devenir TypeScript native (contrainte du moteur).
- Le SQL historique d'une migration doit être réexécuté sur une base
  existante (les `legacyChecksums` couvrent le cas inverse).
- Un audit de `scripts/migrations/` signale un écart.

## Inputs

- Le chemin de la migration à convertir (ex.
  `apps/<bac>/src/infrastructure/migrations/<id>.ts`).
- Le SQL historique : la version du fichier dans `git HEAD`
  (`git show HEAD:<chemin>`).
- L'identifiant canonique et les `legacyChecksums` (checksums déjà présents
  dans le ledger pour le même id).

## Process

1. **Lire la référence.** `git show HEAD:<chemin>` — c'est la source de
   vérité du schéma déployé. Ne jamais convertir depuis l'écran.

2. **Déclarer les ressources.** `resources` liste les tables/colonnes/index
   touchés : c'est la base de la détection de collision (R9).

3. **Convertir vers le DSL.**
   - `context.schema` pour le DDL ; `context.data` pour les DML.
   - Valeurs toujours en paramètres : `value(x)`, jamais de concaténation.
   - Une colonne `NOT NULL` par défaut : `.nullable()` explicite si le SQL
     historique la laissait nullable.
   - `func("now")` pour une expression de default, jamais `raw(...)`.
   - `constant(1)` pour le `SELECT 1` d'une sonde d'existence.
   - `references({ schema, name }, col)` : toujours le schéma de la table
     référencée.

4. **Vérifier la nullabilité et les types.** Les deux pièges les plus
   fréquents : le DSL rend `NOT NULL` par défaut, et `string` rend
   `VARCHAR(255)` (le SQL historique disait parfois `TEXT`).

5. **Vérifier l'équivalence SQL.** `pnpm audit:migrations` — les quatre
   audits (nullabilité, types, références de tables, équivalence SQL) doivent
   sortir 0 écart.

6. **Recalculer les checksums.** `pnpm migration:checksums`, puis
   `pnpm check:migration-checksums` doit être silencieux.

7. **Valider.** `vitest run` sur le périmètre, `tsc --build`, ESLint,
   Prettier.

8. **Conserver les `legacyChecksums`.** Le checksum historique déjà
   enregistré dans le ledger doit rester accepté : la base déjà migrée ne
   doit pas être rejetée (`MigrationChecksumError`).

## Outputs

- La migration convertie (TypeScript natif, sans SQL).
- Les checksums source recalculés.
- Un rapport de session dans `.project/reports/` si le chantier dépasse une
  migration.

## Validation

```bash
pnpm audit:migrations          # 0 écart / 0 anomalie / 0 divergence
pnpm check:migration-checksums # silencieux
npx vitest run <périmètre>     # vert
npx tsc --build tsconfig.build.json
npx eslint <fichiers modifiés>
```

Pour une conversion de masse : comparer le SQL généré à l'historique
instruction par instruction (l'audit `audit-sql-equivalence` le fait).

## Risks

| Risque | Précaution |
|---|---|
| Le DSL rend `NOT NULL` par défaut | `.nullable()` explicite ; l'audit de nullabilité |
| `string` → `VARCHAR(255)`, `text` → `TEXT` | choisir le type qui correspond au SQL historique ; l'audit des types |
| `REFERENCES` sans schéma → FK invalide | toujours qualifier |
| Rollback inventé alors que le SQL historique n'en a pas | migration **irréversible** : pas de `downMigration` |
| `IF EXISTS` perdu sur un `DROP CONSTRAINT` | `dropConstraint(..., { ifExists: true })` |
| Littéral de regex sur-échappé (`^\\d`) | vérifier le paramètre lié, pas le SQL rendu |
| Checksum source figé avant la dernière édition | `pnpm migration:checksums` **après** la dernière modification |

## Notes

- Les audits vivent dans `scripts/migrations/` et sont branchés par
  `pnpm audit:migrations`.
- L'API du moteur est figée : aucun élargissement du DSL sans décision
  d'architecture explicite (revue ChatGPT).
- La procédure a servi de référence pour la conversion des 46 migrations
  (session 2026-11-11).
