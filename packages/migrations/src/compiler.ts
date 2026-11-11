/**
 * @mosaix/migrations — MigrationCompiler (Phase 04).
 *
 * Transforme une migration TypeScript native (up / downMigration) en une
 * liste de SqlStatement[] via la Grammar. Le Compiler ne sait PAS exécuter
 * de SQL : il ne fait que compiler les blueprints produits par le
 * SchemaBuilder pendant l'exécution de up()/downMigration().
 *
 * Le Runner reste responsable de l'exécution, des transactions et du cycle
 * de vie. Le Compiler est invoqué par le Planner (ou le CLI) pour produire
 * le SQL prévisible avant toute exécution (dry-run, audit, approbation).
 */

import type { Blueprint } from "./schema-builder.js";
import type { Grammar, SqlStatement } from "./grammar.js";
import type { Migration } from "./migration.js";
import { assertTypeScriptNativeMigration } from "./migration.js";
import type {
  MigrationContext,
  MigrationDatabase,
  MigrationLogger,
  MigrationRuntime,
} from "./migration-context.js";
import { SchemaBuilder } from "./schema-builder.js";
import { DataBuilder } from "./data-builder.js";

/**
 * Résultat de compilation d'une migration.
 *
 * Le `dialect` retourné correspond toujours au dialecte effectif des
 * instructions compilées (Grammar du compilateur).
 * Il ne doit jamais différer du dialecte utilisé pour générer les statements.
 */
export interface CompilationResult {
  readonly migrationId: string;
  readonly statements: readonly SqlStatement[];
  readonly dialect: "sqlite" | "postgres";
}

/**
 * Contexte de compilation : fournit un SchemaBuilder vide à up()/downMigration()
 * et récupère les blueprints produits. La base de données et le logger sont
 * des mocks : le Compiler n'exécute jamais de SQL.
 */
class CompilationContext implements MigrationContext {
  readonly schema: SchemaBuilder;
  readonly data: DataBuilder;
  readonly database: MigrationDatabase;
  readonly logger: MigrationLogger;
  readonly runtime: MigrationRuntime;

  constructor(runtime: MigrationRuntime) {
    this.schema = new SchemaBuilder();
    this.data = new DataBuilder(this.schema);
    this.database = {
      execute: async () => {
        throw new Error(
          "MigrationCompiler: database.execute() ne doit pas être appelé pendant la compilation. Le schéma et les données se déclarent via context.schema et context.data.",
        );
      },
      query: async () => {
        throw new Error(
          "MigrationCompiler: database.query() ne doit pas être appelé pendant la compilation.",
        );
      },
    };
    this.logger = {
      log: () => {},
      warn: () => {},
      error: () => {},
    };
    this.runtime = runtime;
  }
}

/**
 * Compile une migration TypeScript native en SqlStatement[].
 *
 * Le compilateur reçoit une Grammar, un dialect et un runtime. Il invoque
 * up() / downMigration() avec un SchemaBuilder, récupère les blueprints
 * produits, puis les compile via la Grammar.
 *
 * Throws si la migration n'est pas en mode TypeScript ou si up() manque.
 *
 * @constructor Vérifie à la construction la cohérence entre le dialecte du
 * Compiler, celui de la Grammar et celui du Runtime. Rejette explicitement
 */
export class MigrationCompiler {
  constructor(
    private readonly grammar: Grammar,
    private readonly dialect: "sqlite" | "postgres",
    private readonly runtime: MigrationRuntime,
  ) {
    // Vérifier la cohérence entre le dialecte du Compiler, de la Grammar et du Runtime
    if (grammar.dialect !== undefined && grammar.dialect !== this.dialect) {
      throw new Error(
        `MigrationCompiler: incohérence de dialecte — la Grammar déclare le dialect "${grammar.dialect}" mais le Compiler utilise le dialect "${this.dialect}".`,
      );
    }
    if (this.runtime.dialect !== this.dialect) {
      throw new Error(
        `MigrationCompiler: incohérence de dialecte — le Runtime déclare le dialect "${this.runtime.dialect}" mais le Compiler utilise le dialect "${this.dialect}".`,
      );
    }
  }

  /**
   * Compile la partie up() d'une migration TypeScript native (version sync).
   *
   * @deprecated Utilisez {@link compileUpAsync} [à] la place. Le chemin
   *   asynchrone est le chemin canonique de compilation `up`.
   */
  compileUp(migration: Migration): CompilationResult {
    assertTypeScriptNativeMigration(migration, migration.id);
    if (migration.up === undefined) {
      throw new Error(`Migration "${migration.id}" n'a pas de fonction up().`);
    }

    const ctx = new CompilationContext(this.runtime);
    const result = migration.up(ctx);
    if (result instanceof Promise) {
      throw new Error(
        `Migration "${migration.id}" up() retourne une Promise. Utilisez compileUpAsync() [à] la place.`,
      );
    }

    return this.buildResult(migration, ctx.schema.blueprints);
  }

  /**
   * Compile la partie up() d'une migration TypeScript native (version async).
   *
   * C'est le chemin canonique de compilation `up`. Il compile les blueprints
   * produits par up() via la Grammar — les instructions de schéma
   * (`context.schema`) et de données (`context.data`) sont compilées dans
   * l'ordre déclaré par la migration. Le dialecte retourné correspond au
   * dialecte du compilateur.
   *
   * Contrairement à {@link compileUp}, cette méthode supporte les up()
   * asynchrones.
   */
  async compileUpAsync(migration: Migration): Promise<CompilationResult> {
    assertTypeScriptNativeMigration(migration, migration.id);
    if (migration.up === undefined) {
      throw new Error(`Migration "${migration.id}" n'a pas de fonction up().`);
    }

    const ctx = new CompilationContext(this.runtime);
    await migration.up(ctx);
    return this.buildResult(migration, ctx.schema.blueprints);
  }

  /**
   * Compile la partie downMigration() d'une migration TypeScript native.
   *
   * Les blueprints produits par downMigration() sont compilés via la Grammar.
   * Une migration sans downMigration est consid[ée]r[ée]e comme irr[ée]versible.
   */
  async compileDownAsync(
    migration: Migration,
  ): Promise<CompilationResult | undefined> {
    assertTypeScriptNativeMigration(migration, migration.id);
    if (migration.downMigration === undefined) {
      return undefined; // migration irr[ée]versible
    }

    const ctx = new CompilationContext(this.runtime);
    await migration.downMigration(ctx);
    return this.buildResult(migration, ctx.schema.blueprints);
  }

  /**
   * Construit le résultat de compilation d'une migration TypeScript.
   *
   * Les blueprints du SchemaBuilder sont compilés par la Grammar ; les
   * instructions de données (`context.data`) suivent les blueprints, dans
   * l'ordre déclaré par la migration.
   */
  private buildResult(
    migration: Migration,
    blueprints: readonly Blueprint[],
  ): CompilationResult {
    const statements: SqlStatement[] = [];
    for (const bp of blueprints) {
      statements.push(...this.grammar.compile(bp));
    }

    return {
      migrationId: migration.id,
      statements,
      dialect: this.dialect,
    };
  }
}
