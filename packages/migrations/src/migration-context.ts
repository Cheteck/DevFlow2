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
import type { DataBuilder } from "./data-builder.js";

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
 * Accès base de données à privilèges contrôlés.
 *
 * Une migration ne doit pas utiliser cette interface pour exécuter du SQL
 * brut qui contournerait l'ownership d'une ressource appartenant à un autre
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
  /**
   * Data statements (backfill, seed, normalization) — the Laravel
   * `DB::table()` equivalent. Both builders write into the same ordered
   * list of statements: the interleaving of DDL and DML is preserved.
   */
  readonly data: DataBuilder;
  readonly database: MigrationDatabase;
  readonly logger: MigrationLogger;
  readonly runtime: MigrationRuntime;
}
