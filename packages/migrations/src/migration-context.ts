/**
 * @mosaix/migrations — MigrationContext (Phase 03, contrat natif TypeScript).
 *
 * Fournit aux migrations typées les dépendances nécessaires à leur exécution.
 * Une migration ne reçoit jamais directement une connexion SQL brute.
 *
 * Ce contrat est introduit sans modifier les contrats existants
 * (MigrationProvider, MigrationRegistry, MigrationPlanner, MigrationRunner,
 * MigrationStore). Les migrations SQL historiques (content/down en chaîne)
 * continuent de fonctionner via le mode legacy.
 */

import type { SchemaBuilder } from "./schema-builder.js";

/** Journalisation de migration. */
export interface MigrationLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Informations sur le runtime d'exécution. */
export interface MigrationRuntime {
  readonly dialect: "sqlite" | "postgres";
  readonly capabilities: {
    readonly transactions: boolean;
    readonly lock: {
      readonly distributed: boolean;
      readonly processSafe: boolean;
      readonly runtimeSafe: boolean;
    };
  };
}

/**
 * Instruction SQL brute déclarée explicitement dans une migration.
 *
 * Doit être utilisée avec parcimonie, uniquement lorsque le DSL SchemaBuilder
 * ne suffit pas (ex. ALTER TYPE PostgreSQL, CREATE EXTENSION, index partiels).
 * Déclarer rawSql rend la migration dépendante d'un dialecte spécifique.
 */
export interface RawSqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
  /** Dialecte cible. "both" signifie que le SQL est compatible les deux. */
  readonly dialect: "sqlite" | "postgres" | "both";
  /**
   * Ressources SQL déclarées par cette instruction SQL brute.
   * Doit être un sous-ensemble de migration.resources pour permettre
   * la détection de collisions de ressources (R9).
   */
  readonly resources?: readonly string[];
}

/**
 * Accès base de données à privilèges contrôlés.
 *
 * Une migration ne doit pas utiliser cette interface pour exécuter du SQL
 * brut qui contournerait l'ownership d'une ressource appartenant à un autre
 * owner. Les instructions SQL brutes doivent passer par `rawSql`, déclaré
 * explicitement dans la migration et validé par le MigrationValidator
 * (Phase 04).
 *
 * Cette interface est un sous-ensemble contraduits de `DatabasePort` :
 * seule l'exécution d'instructions SQL déjà compilées est autorisée.
 */
export interface MigrationDatabase {
  /** Exécute une instruction SQL compilée (pas de SQL brut arbitraire). */
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  /** Lit des lignes (schéma, état, audit). */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}

/**
 * Contexte d'exécution d'une migration TypeScript.
 *
 * Fournit :
 * - `schema` : construction de blueprints via le SchemaBuilder
 * - `database` : exécution SQL à privilèges contrôlés
 * - `logger` : journalisation de migration
 * - `runtime` : informations sur le dialecte et les capacités
 */
export interface MigrationContext {
  readonly schema: SchemaBuilder;
  readonly database: MigrationDatabase;
  readonly logger: MigrationLogger;
  readonly runtime: MigrationRuntime;
}