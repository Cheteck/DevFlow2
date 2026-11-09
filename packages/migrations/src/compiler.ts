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
import type {
  MigrationContext,
  MigrationDatabase,
  MigrationLogger,
  MigrationRuntime,
} from "./migration-context.js";
import { MigrationError } from "./errors.js";
import { SchemaBuilder } from "./schema-builder.js";

/**
 * Résultat de compilation d'une migration.
 *
 * Le `dialect` retourné correspond toujours au dialecte effectif des
 * instructions compilées (Grammar du compilateur + rawSql compatible).
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
  readonly database: MigrationDatabase;
  readonly logger: MigrationLogger;
  readonly runtime: MigrationRuntime;

  constructor(runtime: MigrationRuntime) {
    this.schema = new SchemaBuilder();
    this.database = {
      execute: async () => {
        throw new Error(
          "MigrationCompiler: database.execute() ne doit pas être appelé pendant la compilation. Utilisez rawSql pour le SQL dialecte spécifique.",
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
 * un rawSql dont le dialecte est incompatible avec le dialecte courant.
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
   * Vérifie que la migration est en mode TypeScript natif.
   *
   * @throws MigrationError si la migration n'est pas en kind "typescript".
   */
  private assertTypeScript(migration: Migration): void {
    if (migration.kind !== "typescript") {
      throw new Error(
        `Migration "${migration.id}" n'est pas une migration TypeScript native (kind !== "typescript").`,
      );
    }
  }

  /**
   * Compile la partie up() d'une migration TypeScript native (version sync).
   *
   * Les blueprints produits par up() sont compilés via la Grammar, puis les
   * instructions rawSql déclarées explicitement sont ajoutées à la fin.
   *
   * @deprecated Utilisez {@link compileUpAsync} à la place. Le chemin
   *   asynchrone est le chemin canonique de compilation `up`.
   */
  compileUp(migration: Migration): CompilationResult {
    this.assertTypeScript(migration);
    if (migration.up === undefined) {
      throw new Error(
        `Migration "${migration.id}" déclare kind "typescript" mais n'a pas de fonction up().`,
      );
    }

    const ctx = new CompilationContext(this.runtime);
    const result = migration.up(ctx);
    if (result instanceof Promise) {
      throw new Error(
        `Migration "${migration.id}" up() retourne une Promise. Utilisez compileUpAsync() à la place.`,
      );
    }

    return this.buildResultWithRawSql(migration, ctx.schema.blueprints);
  }

  /**
   * Compile la partie up() d'une migration TypeScript native (version async).
   *
   * C'est le chemin canonique de compilation `up`. Il compile les blueprints
   * produits par up() via la Grammar, puis intègre automatiquement les
   * instructions rawSql déclarées (après les blueprints, dans l'ordre
   * contractuel). Le dialecte retourné correspond au dialecte du compilateur.
   *
   * Contrairement à {@link compileUp}, cette méthode supporte les up()
   * asynchrones. Contrairement à {@link compileUpWithRawSql}, elle est le
   * point d'entrée recommandé : compileUpWithRawSql n'est qu'un alias.
   */
  async compileUpAsync(migration: Migration): Promise<CompilationResult> {
    this.assertTypeScript(migration);
    if (migration.up === undefined) {
      throw new Error(
        `Migration "${migration.id}" déclare kind "typescript" mais n'a pas de fonction up().`,
      );
    }

    const ctx = new CompilationContext(this.runtime);
    await migration.up(ctx);
    return this.buildResultWithRawSql(migration, ctx.schema.blueprints);
  }

  /**
   * Compile la partie downMigration() d'une migration TypeScript native.
   *
   * La méthode downMigration ne compile PAS les instructions rawSql :
   * les instructions rawSql sont définies pour la phase up uniquement.
   * Il n'y a pas de rollback automatique via rawSql : si aucune instruction
   * inverse n'est déclarée (pas de downMigration), la migration reste
   * irréversible et cette méthode retourne `undefined`.
   *
   * Une migration sans downMigration est considérée comme irréversible.
   */
  async compileDownAsync(
    migration: Migration,
  ): Promise<CompilationResult | undefined> {
    this.assertTypeScript(migration);
    if (migration.downMigration === undefined) {
      return undefined; // migration irréversible
    }

    const ctx = new CompilationContext(this.runtime);
    await migration.downMigration(ctx);
    return this.buildResult(migration, ctx.schema.blueprints);
  }

  /**
   * Compile une migration SQL legacy (content string) en une seule statement.
   * Le SQL n'est pas parsé : il est retourné tel quel.
   */
  compileSql(migration: Migration): CompilationResult {
    if (migration.content === undefined) {
      throw new Error(
        `Migration "${migration.id}" n'a pas de content à compiler.`,
      );
    }

    return {
      migrationId: migration.id,
      statements: [{ sql: migration.content, params: [] }],
      dialect: this.dialect,
    };
  }

  /**
   * Compile une migration TypeScript native en SqlStatement[], y compris
   * les instructions rawSql déclarées explicitement.
   *
   * Les instructions rawSql sont compilées en SqlStatement supplémentaires,
   * avec leur dialecte et leurs paramètres. Elles sont placées après les
   * blueprints du SchemaBuilder.
   *
   * Cette méthode est un alias temporaire compatible de {@link compileUpAsync}.
   * Elle est conservée pour les appelants existants. Le chemin canonique est
   * compileUpAsync().
   */
  async compileUpWithRawSql(migration: Migration): Promise<CompilationResult> {
    return this.compileUpAsync(migration);
  }

  /**
   * Vérifie que le dialecte d'un rawSql est compatible avec le dialecte
   * du compilateur.
   *
   * Si le dialecte du rawSql est "both", il est compatible avec tous les
   * dialectes. Sinon, il doit correspondre exactement au dialecte du
   * compilateur.
   *
   * @throws MigrationError si le dialecte du rawSql est incompatible.
   */
  private validateRawSqlDialect(migration: Migration): void {
    if (!migration.rawSql) return;

    const rawDialect = migration.rawSql.dialect;
    if (rawDialect === "both") return; // Compatible avec tous les dialectes

    if (rawDialect !== this.dialect) {
      throw new MigrationError(
        `Migration "${migration.id}" déclare un rawSql avec le dialect "${migration.rawSql.dialect}" ` +
          `mais le compilateur utilise le dialect "${this.dialect}". ` +
          `Le dialecte du rawSql doit être compatible avec celui du compilateur. ` +
          `Utilisez "both" pour une compatibilité universelle.`,
      );
    }
  }

  /**
   * Construit le résultat de compilation d'une migration TypeScript, y compris
   * les instructions rawSql déclarées explicitement.
   *
   * Les blueprints du SchemaBuilder sont compilés en premier, puis les
   * instructions rawSql sont ajoutées à la fin, avec leur dialecte propre.
   */
  private buildResultWithRawSql(
    migration: Migration,
    blueprints: readonly Blueprint[],
  ): CompilationResult {
    // Vérifier la compatibilité du dialecte du rawSql
    this.validateRawSqlDialect(migration);

    const statements: SqlStatement[] = [];
    for (const bp of blueprints) {
      statements.push(...this.grammar.compile(bp));
    }

    // Ajouter les instructions rawSql déclarées explicitement, après les blueprints
    if (migration.rawSql) {
      statements.push({
        sql: migration.rawSql.sql,
        params: migration.rawSql.params,
      });
    }

    return {
      migrationId: migration.id,
      statements,
      dialect: this.dialect,
    };
  }

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