/**
 * @mosaix/migrations — MigrationValidator (Phase 04, durci Phase 07).
 *
 * Valide une migration AVANT qu'elle n'atteigne le Planner et le Runner.
 * Toute déclaration invalide est rejetée avec une erreur typée, jamais
 * interprétée silencieusement.
 *
 * Ce composant est autonome : il ne modifie pas le Runner, le Store ni
 * aucune migration existante. Il est invoqué par le Registry (à
 * l'enregistrement) et par le Planner (avant exécution).
 */

import type { Migration } from "./migration.js";
import type { MigrationProvider } from "./migration.js";
import { assertTypeScriptNativeMigration } from "./migration.js";
import {
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
 * Le moteur n'accepte QUE des migrations TypeScript natives :
 *
 * | Déclaration | Résultat attendu |
 * |---|---|
 * | `up(context)` + checksum explicite | Acceptée |
 * | `up(context)` sans checksum explicite | Rejetée |
 * | `up(context)` + `downMigration(context)` | Acceptée |
 * | Déclaration portant `content`, `down` ou `kind` | Rejetée |
 * | `resources[]` vide ou absent | Rejetée |
 *
 * Les collisions d'identité entre providers et les collisions de ressources
 * sont détectées au niveau du Registry et du Planner, pas ici.
 */
export class MigrationValidator {
  /**
   * Valide une migration individuelle.
   *
   * Règles appliquées :
   * 1. TypeScript natif uniquement : toute déclaration portant les champs
   *    SQL legacy (`content`, `down`, `kind`) est rejetée.
   * 2. `up(context)` obligatoire.
   * 3. Checksum explicite obligatoire (digest hexadécimal du code source).
   * 4. Dépendances : pas de dépendance sur soi-même, pas de doublons.
   * 5. Ressources : `resources[]` présent et non vide.
   * 6. legacyChecksums : digests hexadécimaux, distincts du checksum courant.
   */
  validate(migration: Migration): ValidationResult {
    const errors: MigrationError[] = [];

    this.assertTypeScriptOnly(migration, errors);
    this.assertUpBody(migration, errors);
    this.assertChecksum(migration, errors);
    this.assertLegacyChecksums(migration, errors);
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
        const resources = new Set<string>();
        if (migration.resources) {
          for (const r of migration.resources) resources.add(r);
        }

        for (const resource of resources) {
          const existing = resourceOwners.get(resource);
          if (existing !== undefined && existing !== ownerId) {
            errors.push(
              new MigrationResourceConflictError(resource, [existing, ownerId]),
            );
          }
          resourceOwners.set(resource, ownerId);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Rejette toute déclaration portant les champs SQL legacy.
   *
   * Le moteur n'accepte que des migrations TypeScript natives : la règle
   * est appliquée ici, dans le code, et pas seulement documentée.
   */
  private assertTypeScriptOnly(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    try {
      assertTypeScriptNativeMigration(migration, migration.id);
    } catch (cause) {
      errors.push(
        cause instanceof MigrationError
          ? cause
          : new MigrationError(
              `Migration "${migration.id}" violates the TypeScript native contract.`,
            ),
      );
    }
  }

  /** `up(context)` est obligatoire : c'est le seul corps d'upgrade accepté. */
  private assertUpBody(migration: Migration, errors: MigrationError[]): void {
    if (typeof migration.up !== "function") {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" ne fournit pas de fonction 'up'. ` +
            `Le moteur n'accepte que des migrations TypeScript natives.`,
        ),
      );
    }
  }

  /**
   * Exige un checksum explicite pour les migrations TypeScript (réserve P1
   * ChatGPT). Le checksum doit être fourni au build, couvrant le contenu
   * source réel. Un checksum calculé automatiquement (Function.toString())
   * ne couvre pas le comportement du corps de up().
   */
  private assertChecksum(migration: Migration, errors: MigrationError[]): void {
    if (migration.checksum === undefined || migration.checksum.length === 0) {
      errors.push(
        new MigrationError(
          `Migration "${migration.id}" ne fournit pas de checksum explicite. Un checksum généré au build couvrant le ` +
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

  /**
   * Valide les checksums historiques déclarés (`legacyChecksums`).
   *
   * Chaque entrée doit être un digest hexadécimal non vide : ce sont des
   * empreintes de contenu, pas des identifiants opaques.
   */
  private assertLegacyChecksums(
    migration: Migration,
    errors: MigrationError[],
  ): void {
    if (!migration.legacyChecksums) return;

    for (const [index, checksum] of migration.legacyChecksums.entries()) {
      if (!checksum || !/^[0-9a-fA-F]+$/.test(checksum)) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" legacyChecksums[${index}] n'est pas un digest hexadécimal valide.`,
          ),
        );
      }
      if (checksum === migration.checksum) {
        errors.push(
          new MigrationError(
            `Migration "${migration.id}" déclare son checksum courant dans legacyChecksums. ` +
              `Le checksum effectif doit être distinct des checksums historiques.`,
          ),
        );
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
            `Migration "${migration.id}" déclare une dépendance vide. Les dépendances ne peuvent pas contenir des segments vides.`,
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
   * d'au moins 16 caractères. Cette vérification est indicative ;
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
