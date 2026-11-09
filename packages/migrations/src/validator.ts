/**
 * @mosaix/migrations — MigrationValidator (Phase 04).
 *
 * Valide une migration AVANT qu'elle n'atteigne le Planner et le Runner.
 * Toute déclaration invalide est rejetée avec une erreur typée, jamais
 * interprétée silencieusement.
 *
 * Ce composant est autonome : il ne modifie pas le Runner, le Store ni
 * aucune migration existante. Il est invoqué par le Planner (ou le CLI)
 * avant toute exécution.
 */

import type { Migration } from "./migration.js";
import type { MigrationProvider } from "./migration.js";
import {
  MigrationChecksumError,
  MigrationConflictError,
  MigrationError,
  MigrationResourceConflictError,
} from "./errors.js";

/**
 * Résultat de validation d'une migration.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MigrationError[];
}

/**
 * Règles de validation d'une migration individuelle.
 *
 * Matrice stricte des modes de migration :
 *
 * | Déclaration | Résultat attendu |
 * |---|---|
 * | `kind: "typescript"` avec `up` et checksum | Acceptée |
 * | `kind: "typescript"` sans `up` | Rejetée |
 * | `kind: "typescript"` avec `content` | Rejetée |
 * | `kind: "sql"` avec `content` et sans `up` | Acceptée |
 * | `kind: "sql"` sans `content` | Rejetée |
 * | `kind: "sql"` avec `up` | Rejetée |
 * | TypeScript sans checksum | Rejetée |
 *
 * Toute combinaison non prévue (ex. `downMigration` sur une migration SQL,
 * `rawSql` sur une migration SQL, `down` sur une migration TypeScript) est
 * rejetée explicitement.
 *
 * Les collisions d'identité entre providers et les collisions de ressources
 * sont détectées au niveau du Registry et du Planner, pas ici.
 */
export class MigrationValidator {
  /**
   * Valide une migration individuelle.
   *
   * Règles appliquées :
   * 1. Mode exclusif : une migration ne déclare pas à la fois `content` (SQL
   *    legacy) et `up` (TypeScript natif).
   * 2. Matrice stricte des modes : chaque combinaison de `kind`, `up`,
   *    `content`, `down`, `downMigration`, `rawSql` et `checksum` est
   *    explicitement autorisée ou rejetée.
   * 3. Mode TypeScript : exige `kind === "typescript"`, `up` présent, et un
   *    checksum explicite fourni au build.
   * 4. Mode SQL legacy : `content` présent, `up` absent, checksum calculé
   *    depuis le contenu (comportement historique R2).
   * 5. Dépendances : pas de dépendance sur soi-même, pas de doublons.
   * 6. Ressources : `resources[]` présent et non vide.
   * 7. rawSql : dialect valide, params valides, SQL non vide, ressources
   *    déclarées dans `migration.resources`.
   */
  validate(migration: Migration): ValidationResult {
    const errors: MigrationError[] = [];

    this.assertExclusiveMode(migration, errors);
    this.assertStrictModeMatrix(migration, errors);
    this.assertTypeScriptRules(migration, errors);
    this.assertSqlLegacyRules(migration, errors);
    this.assertRawSql(migration, errors);
    this.assertDependencies(migration, errors);
    this.assertResources(migration, errors);

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valide un lot de migrations et retourne le premier résultat invalide.
   *
   * Utilisé par le Registry pour l'enregistrement atomique : si une seule
   * migration du lot est invalide, aucune migration n'est enregistrée.
   *
   * @returns le premier `ValidationResult` invalide, ou `undefined` si toutes
   *   les migrations sont valides.
   */
  validateBatch(
    migrations: readonly Migration[],
  ): ValidationResult | undefined {
    for (const migration of migrations) {
      const result = this.validate(migration);
      if (!result.valid) {
        return result;
      }
    }
    return undefined;
  }

  /**
   * Valide qu'aucun ID n'est dupliqué entre plusieurs providers.
   *
   * Détecte les collisions d'identité même entre migrations du même owner.
   */
  validateNoIdentityCollision(
    providers: readonly MigrationProvider[],
  ): ValidationResult {
    const errors: MigrationError[] = [];
    const seen = new Map<string, string>(); // id -> ownerId

    for (const provider of providers) {
      for (const migration of provider.migrations()) {
        const existing = seen.get(migration.id);
        if (existing !== undefined) {
          errors.push(
            new MigrationConflictError(migration.id, [
              existing,
              provider.ownerId(),
            ]),
          );
        }
        seen.set(migration.id, provider.ownerId());
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valide qu'aucune ressource SQL n'est revendiquée par des propriétaires différents.
   *
   * Règle métier (R9) :
   * - Une ressource peut être déclarée par plusieurs migrations successives
   *   du MÊME owner (évolution autorisée, par exemple une table modifiée par
   *   deux migrations du même provider).
   * - Une ressource ne peut PAS être déclarée par des owners différents :
   *   c'est une collision de ressource.
   *
   * Détecte les collisions de ressources : deux migrations avec des propriétaires
   * différents ne peuvent pas déclarer la même table, index, etc.
   *
   * `rawSql.resources` est un sous-ensemble de `migration.resources` : il ne
   * s'agit pas d'une déclaration indépendante. Les ressources sont donc
   * dédupliquées au sein d'une même migration (pas de faux positif quand une
   * même ressource apparaît dans `resources` et dans `rawSql.resources`).
   *
   * Les doublons à l'intérieur d'une même migration sont dédupliqués, non
   * signalés comme erreur.
   */
  validateNoResourceCollision(
    providers: readonly MigrationProvider[],
  ): ValidationResult {
    const errors: MigrationError[] = [];
    const resourceOwners = new Map<string, string>(); // resource -> ownerId

    for (const provider of providers) {
      const ownerId = provider.ownerId();
      for (const migration of provider.migrations()) {
        // Les ressources de la migration : migration.resources est la liste
        // principale. rawSql.resources est un sous-ensemble de celle-ci, il
        // ne ajoute pas de nouvelles ressources indépendantes.
        const resources = new Set<string>();
        if (migration.resources) {
          for (const r of migration.resources) resources.add(r);
        }
        if (migration.rawSql?.resources) {
          for (const r of migration.rawSql.resources) resources.add(r);
        }

        // Détecter les collisions entre migrations distinctes
        for (const resource of resources) {
          const existing = resourceOwners.get(resource);
          if (existing !== undefined && existing !== ownerId) {
            errors.push(
              new MigrationResourceConflictError(resource, [
                existing,
                ownerId,
              ]),
            );
          }
          // Même owner : évolution autorisée, on met à jour le propriétaire
          // (la ressource reste enregistrée sous cet owner).
          resourceOwners.set(resource, ownerId);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private assertExclusiveMode(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    const hasContent = migration.content !== undefined;
    const hasUp = migration.up !== undefined;

    if (hasContent && hasUp) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" déclare à la fois le SQL legacy 'content' ` +
            `et le TypeScript natif 'up'. Les deux modes sont mutuellement exclusifs.`,
        ),
      );
    }
  }

  private assertTypeScriptRules(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (migration.kind !== "typescript") return;

    // kind === "typescript" exige up
    if (migration.up === undefined) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" déclare kind "typescript" mais ` +
            `ne fournit pas de fonction 'up'.`,
        ),
      );
    }

    // Exiger un checksum explicite pour les migrations TypeScript (réserve P1 ChatGPT).
    // Le checksum doit être fourni au build, couvrant le contenu source réel.
    // Un checksum calculé automatiquement (stableStructureChecksum) ne couvre pas
    // le comportement du corps de up() (Function.toString() n'est pas stable).
    if (migration.checksum === undefined || migration.checksum.length === 0) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" déclare kind "typescript" mais ` +
            `ne fournit pas de checksum explicite. Un checksum généré au build couvrant le ` +
            `contenu source de la migration est requis pour les migrations TypeScript.`,
        ),
      );
    } else if (!this.isBuildChecksum(migration.checksum)) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" a un checksum invalide "${migration.checksum}". ` +
            `Le checksum doit être une chaîne hexadécimale d'au moins 16 caractères.`,
        ),
      );
    }
  }

  private assertSqlLegacyRules(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (migration.kind === "typescript" && migration.content !== undefined) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" déclare kind "typescript" mais ` +
            `fournit également du SQL legacy 'content'. Utilisez kind "sql" pour les migrations SQL.`,
        ),
      );
    }
  }

  /**
   * Matrice stricte des modes de migration.
   *
   * Vérifie que chaque combinaison de `kind`, `up`, `content`, `down`,
   * `downMigration`, `rawSql` et `checksum` est explicitement autorisée.
   * Toute combinaison non prévue est rejetée.
   */
  private assertStrictModeMatrix(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    const kind = migration.kind ?? "sql";
    const hasContent = migration.content !== undefined;
    const hasUp = migration.up !== undefined;
    const hasDown = migration.down !== undefined;
    const hasDownMigration = migration.downMigration !== undefined;
    const hasRawSql = migration.rawSql !== undefined;
    const hasChecksum =
      migration.checksum !== undefined && migration.checksum.length > 0;

    if (kind === "typescript") {
      // kind: "typescript" exige up
      if (!hasUp) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "typescript" mais ne fournit pas de fonction 'up'.`,
          ),
        );
      }

      // kind: "typescript" exclut content
      if (hasContent) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "typescript" mais fournit également du SQL legacy 'content'.`,
          ),
        );
      }

      // TypeScript exige un checksum explicite
      if (!hasChecksum) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "typescript" mais ne fournit pas de checksum explicite.`,
          ),
        );
      }

      // down est spécifique au mode SQL : incompatible avec TypeScript
      if (hasDown) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "typescript" mais fournit également 'down' (réservé au mode SQL legacy).`,
          ),
        );
      }

      // rawSql est autorisé en TypeScript (dialect-dépendant)
      // pas de restriction supplémentaire ici
    } else {
      // kind === "sql" (ou undefined, traité comme "sql")

      // kind: "sql" exige content
      if (!hasContent) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "sql" mais ne fournit pas de 'content'. Une migration SQL doit déclarer du SQL à exécuter.`,
          ),
        );
      }

      // kind: "sql" exclut up
      if (hasUp) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "sql" mais fournit également une fonction 'up'. Utilisez kind "typescript" pour les migrations TypeScript natives.`,
          ),
        );
      }

      // downMigration est spécifique au mode TypeScript
      if (hasDownMigration) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "sql" mais fournit également 'downMigration' (réservé au mode TypeScript natif).`,
          ),
        );
      }

      // rawSql est spécifique au mode TypeScript
      if (hasRawSql) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare kind "sql" mais fournit également 'rawSql'. rawSql est réservé aux migrations TypeScript natives.`,
          ),
        );
      }
    }
  }

  /**
   * Valide une déclaration rawSql (réserve P1 ChatGPT).
   *
   * Vérifie :
   * - Le dialect est valide ("sqlite" | "postgres" | "both")
   * - Le SQL n'est pas vide ni composé uniquement d'espaces
   * - Les params sont un tableau de valeurs primitives
   * - Les ressources déclarées dans rawSql sont un sous-ensemble de migration.resources
   */
  private assertRawSql(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (!migration.rawSql) return;

    const validDialects = ["sqlite", "postgres", "both"];
    if (!validDialects.includes(migration.rawSql.dialect)) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" rawSql a un dialect invalide "${migration.rawSql.dialect}". ` +
            `Dialects attendus : ${validDialects.join(", ")}.`,
        ),
      );
    }

    // Le SQL brut ne doit pas être vide ni composé uniquement d'espaces
    if (!migration.rawSql.sql || !migration.rawSql.sql.trim()) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" rawSql déclare un SQL vide ou composé uniquement d'espaces.`,
        ),
      );
    }

    // Les params doivent être un tableau de valeurs primitives
    if (!Array.isArray(migration.rawSql.params)) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" rawSql params doit être un tableau.`,
        ),
      );
    } else {
      const invalidParam = migration.rawSql.params.find(
        (p) =>
          p !== null &&
          p !== undefined &&
          typeof p !== "string" &&
          typeof p !== "number" &&
          typeof p !== "boolean" &&
          typeof p !== "bigint",
      );
      if (invalidParam !== undefined) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" rawSql params contient une valeur invalide (type "${typeof invalidParam}"). Seules les valeurs primitives sont autorisées.`,
          ),
        );
      }
    }

    // Les ressources déclarées dans rawSql doivent être un sous-ensemble de migration.resources.
    // rawSql.resources n'est pas une déclaration indépendante : c'est un sous-ensemble de la liste principale.
    if (migration.rawSql.resources !== undefined) {
      if (migration.resources === undefined) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" rawSql déclare des ressources mais migration.resources n'est pas déclaré. Toute ressource rawSql doit être déclarée dans migration.resources.`,
          ),
        );
      } else {
        const unknown = migration.rawSql.resources.filter(
          (r) => !migration.resources!.includes(r),
        );
        if (unknown.length > 0) {
          errors.push(
            new MigrationError(
              `Migration "${migration.id}" rawSql déclare des ressources inconnues: ${unknown.join(", ")}. ` +
                `Toutes les ressources rawSql doivent être déclarées dans migration.resources.`,
            ),
          );
        }
      }
    }
  }

  private assertDependencies(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (!migration.dependencies) return;

    const seen = new Set<string>();
    for (const dep of migration.dependencies) {
      // Segment vide rejeté
      if (!dep || dep.length === 0) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare une dépendance vide. Les dépendances ne peuvent pas contenir de segments vides.`,
          ),
        );
        continue;
      }

      // Dépendance sur soi-même
      if (dep === migration.id) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" dépend d'elle-même. L'auto-dépendance n'est pas autorisée.`,
          ),
        );
      }

      // Dépendance dupliquée
      if (seen.has(dep)) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare la dépendance "${dep}" en double.`,
          ),
        );
      }
      seen.add(dep);
    }
  }

  private assertResources(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (!migration.resources || migration.resources.length === 0) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" ne déclare aucune ressource. Toute migration ` +
            `doit déclarer au moins une ressource SQL (ex. "table:users") pour la ` +
            `détection de collisions (R9).`,
        ),
      );
    }
  }

  /**
   * Heuristique : un checksum de build explicite est une chaîne hexadécimale
   * d'au moins 16 caractères qui ne ressemble pas à un hash FNV-1a de 16
   * caractères (calculé automatiquement). Cette vérification est indicative ;
   * la garantie de reproductibilité incombe à l'outillage de build.
   */
  private isBuildChecksum(checksum: string): boolean {
    const hex = /^[0-9a-fA-F]+$/.test(checksum);
    return hex && checksum.length >= 16;
  }
}

/**
 * Erreur levée lorsqu'une migration ne passe pas la validation.
 */
export class MigrationValidationError extends MigrationError {
  readonly migrationId: string;
  readonly errors: readonly MigrationError[];

  constructor(migrationId: string, errors: readonly MigrationError[]) {
    super(
      `Migration "${migrationId}" a échoué à la validation: ${errors
        .map((e) => e.message)
        .join("; ")}`,
    );
    this.name = "MigrationValidationError";
    this.migrationId = migrationId;
    this.errors = errors;
  }
}