/**
 * SchemaBuilder — Core Blueprint AST and fluent DSL for schema alterations.
 * Aligned with PRD-0006 §Phase 2 requirements.
 */

import type { Condition, SelectStatement } from "./expressions.js";

export type { Condition, SelectStatement };

import type { Grammar, SqlStatement } from "./grammar.js";

export interface ColumnDefinition {
  readonly name: string;
  readonly type:
    | "string"
    | "text"
    | "integer"
    | "bigInteger"
    | "decimal"
    | "real"
    | "uuid"
    | "timestamp"
    | "timestampWithoutTimeZone"
    | "json"
    | "enum"
    | "boolean";
  /** Length of a `string` column (`VARCHAR(n)` on PostgreSQL). */
  readonly length?: number;
  readonly primary?: boolean;
  readonly nullable?: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
  /** Inline `UNIQUE` constraint on the column. */
  readonly unique?: boolean;
  /** Inline `CHECK` expression on the column. */
  readonly check?: string;
  /** Inline `REFERENCES` constraint on the column. */
  readonly references?: {
    /** Schema owning the referenced table (PostgreSQL). */
    readonly schema?: string;
    readonly table: string;
    readonly column: string;
  };
}

export interface ForeignKeyDefinition {
  readonly column: string;
  readonly referencesTable: string;
  readonly referencesColumn: string;
}

export interface IndexDefinition {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
}

export interface CreateTableBlueprint {
  readonly type: "createTable";
  readonly table: string;
  /** Schema owning the table (PostgreSQL). */
  readonly schema?: string;
  /** Emit `IF NOT EXISTS`. */
  readonly ifNotExists?: boolean;
  readonly columns: readonly ColumnDefinition[];
  readonly foreignKeys: readonly ForeignKeyDefinition[];
  readonly indexes: readonly IndexDefinition[];
  /** Inline table-level constraints (PRIMARY KEY / UNIQUE). */
  readonly tableConstraints?: readonly string[];
}

export interface DropTableBlueprint {
  readonly type: "dropTable";
  readonly table: string;
  readonly schema?: string;
  /** Emit `IF EXISTS`. */
  readonly ifExists?: boolean;
}

export interface AddColumnBlueprint {
  readonly type: "addColumn";
  readonly table: string;
  readonly schema?: string;
  /** Emit `IF NOT EXISTS`. */
  readonly ifNotExists?: boolean;
  readonly column: ColumnDefinition;
}

export interface DropColumnBlueprint {
  readonly type: "dropColumn";
  readonly table: string;
  readonly schema?: string;
  readonly column: string;
  /** Emit `IF EXISTS`. */
  readonly ifExists?: boolean;
}

export interface RenameColumnBlueprint {
  readonly type: "renameColumn";
  readonly table: string;
  readonly schema?: string;
  readonly from: string;
  readonly to: string;
}

export interface RenameTableBlueprint {
  readonly type: "renameTable";
  readonly table: string;
  readonly schema?: string;
  readonly to: string;
}

export interface CreateIndexBlueprint {
  readonly type: "createIndex";
  readonly table: string;
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
  /** Sort direction per column (default "asc"). */
  readonly directions?: readonly ("asc" | "desc")[];
  /** Schema owning the index (PostgreSQL). */
  readonly schema?: string;
  /** Emit `IF NOT EXISTS`. */
  readonly ifNotExists?: boolean;
  /** Partial index: only the rows matching these conditions are indexed. */
  readonly where?: readonly Condition[];
}

/**
 * A table, optionally qualified by its schema.
 *
 * The historical SchemaBuilder API works on unqualified tables (the
 * connection's default schema). The schema-aware operations (constraints,
 * column types, schema moves) need the qualification: PostgreSQL schemas
 * are the backbone of the BAC isolation (ADR-0014).
 */
export interface QualifiedTable {
  /** Schema owning the table. Omitted → the default schema. */
  readonly schema?: string;
  /** Table name. */
  readonly name: string;
}

/** Normalizes a table reference (`"users"` or `{ schema, name }`). */
export function resolveTable(table: string | QualifiedTable): {
  readonly schema?: string;
  readonly name: string;
} {
  return typeof table === "string" ? { name: table } : table;
}

/** A column of an index, with its optional sort direction. */
export interface IndexColumn {
  readonly name: string;
  readonly direction?: "asc" | "desc";
}

/** A column of an index: a plain name or a name with its sort direction. */
export type IndexColumnRef = string | IndexColumn;

/** Options of an index creation. */
export interface CreateIndexOptions {
  readonly unique?: boolean;
  readonly ifNotExists?: boolean;
  /** Partial index: only the rows matching this condition are indexed. */
  readonly where?: Condition | readonly Condition[];
}

export interface CreateSchemaBlueprint {
  readonly type: "createSchema";
  readonly schema: string;
}

export interface MoveTableToSchemaBlueprint {
  readonly type: "moveTableToSchema";
  readonly table: string;
  readonly fromSchema: string;
  readonly toSchema: string;
}

export interface RenameTableInSchemaBlueprint {
  readonly type: "renameTableInSchema";
  readonly schema: string;
  readonly table: string;
  readonly to: string;
}

export interface AddConstraintBlueprint {
  readonly type: "addConstraint";
  readonly schema?: string;
  readonly table: string;
  readonly name: string;
  /** Constraint expression, e.g. `UNIQUE ("a", "b")` or `CHECK ("q" > 0)`. */
  readonly definition: string;
}

export interface DropConstraintBlueprint {
  readonly type: "dropConstraint";
  readonly schema?: string;
  readonly table: string;
  readonly name: string;
  /**
   * Emit `IF EXISTS` on the table (`ALTER TABLE IF EXISTS …`).
   *
   * The historical migrations declared it: dropping the constraint of a
   * table that does not exist (yet) must not fail.
   */
  readonly ifExists?: boolean;
}

export interface AlterColumnTypeBlueprint {
  readonly type: "alterColumnType";
  readonly schema?: string;
  readonly table: string;
  readonly column: string;
  readonly columnType: ColumnDefinition["type"];
}

export interface AlterColumnDefaultBlueprint {
  readonly type: "alterColumnDefault";
  readonly schema?: string;
  readonly table: string;
  readonly column: string;
  /** Undefined → the default is dropped. */
  readonly value?: unknown;
}

export interface AlterColumnNullableBlueprint {
  readonly type: "alterColumnNullable";
  readonly schema?: string;
  readonly table: string;
  readonly column: string;
  readonly nullable: boolean;
}

export interface DropIndexBlueprint {
  readonly type: "dropIndex";
  readonly schema?: string;
  readonly name: string;
}

/** A row inserted by a migration (data migration, no raw SQL). */
export interface InsertRowBlueprint {
  readonly type: "insertRow";
  readonly schema?: string;
  readonly table: string;
  readonly row: Readonly<Record<string, unknown>>;
  /** `ON CONFLICT DO NOTHING`. */
  readonly onConflictIgnore?: boolean;
}

/** Rows inserted from a SELECT statement (data migration, no raw SQL). */
export interface InsertSelectBlueprint {
  readonly type: "insertSelect";
  readonly schema?: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly select: SelectStatement;
  /** `ON CONFLICT DO NOTHING`. */
  readonly onConflictIgnore?: boolean;
}

/** A row updated by a migration (data migration, no raw SQL). */
export interface UpdateRowBlueprint {
  readonly type: "updateRow";
  readonly schema?: string;
  readonly table: string;
  readonly assignments: Readonly<Record<string, unknown>>;
  readonly where: readonly Condition[];
}

/** Rows deleted by a migration (data migration, no raw SQL). */
export interface DeleteRowBlueprint {
  readonly type: "deleteRow";
  readonly schema?: string;
  readonly table: string;
  readonly where: readonly Condition[];
}

/** A trigger dropped by a migration. */
export interface DropTriggerBlueprint {
  readonly type: "dropTrigger";
  readonly schema?: string;
  readonly name: string;
  readonly table: string;
}

/** A database function dropped by a migration. */
export interface DropFunctionBlueprint {
  readonly type: "dropFunction";
  readonly schema?: string;
  readonly name: string;
}

/**
 * A database function created by a migration.
 *
 * The body is the function definition (PL/pgSQL), not a SQL command: the
 * engine owns the command (`CREATE OR REPLACE FUNCTION`), the migration
 * owns the code of the function.
 */
/**
 * The body of a database function.
 *
 * TRUSTED: this is the one place where the migration carries procedural
 * code (PL/pgSQL). It is never a DDL/DML command — the engine owns the
 * command (`CREATE OR REPLACE FUNCTION`), the migration owns the body of the
 * function.
 */
export type TrustedFunctionBody = string & {
  readonly __trustedFunctionBody?: never;
};

export interface CreateFunctionBlueprint {
  readonly type: "createFunction";
  readonly schema?: string;
  readonly name: string;
  readonly definition: TrustedFunctionBody;
  /** Return type (`TRIGGER`, `void`, ...). */
  readonly returns?: string;
  /** Language of the body (`plpgsql`, `sql`, ...). */
  readonly language?: string;
  /** `OR REPLACE`. */
  readonly replace?: boolean;
}

/** A trigger created by a migration. */
export interface CreateTriggerBlueprint {
  readonly type: "createTrigger";
  readonly schema?: string;
  readonly name: string;
  readonly table: string;
  readonly timing: "before" | "after" | "instead of";
  readonly events: readonly ("insert" | "update" | "delete" | "truncate")[];
  /** `FOR EACH ROW`. */
  readonly forEachRow?: boolean;
  /** Name of the function executed by the trigger. */
  readonly function: string;
  /** Schema owning the function. */
  readonly functionSchema?: string;
  /** Optional `WHEN` condition. */
  readonly when?: string;
}

export type Blueprint =
  | CreateTableBlueprint
  | DropTableBlueprint
  | AddColumnBlueprint
  | DropColumnBlueprint
  | RenameColumnBlueprint
  | RenameTableBlueprint
  | CreateIndexBlueprint
  | CreateSchemaBlueprint
  | MoveTableToSchemaBlueprint
  | RenameTableInSchemaBlueprint
  | AddConstraintBlueprint
  | DropConstraintBlueprint
  | AlterColumnTypeBlueprint
  | AlterColumnDefaultBlueprint
  | AlterColumnNullableBlueprint
  | DropIndexBlueprint
  | InsertRowBlueprint
  | InsertSelectBlueprint
  | UpdateRowBlueprint
  | DeleteRowBlueprint
  | CreateFunctionBlueprint
  | CreateTriggerBlueprint
  | DropTriggerBlueprint
  | DropFunctionBlueprint;

interface WritableColumn {
  name: string;
  type: ColumnDefinition["type"];
  primary?: boolean;
  nullable?: boolean;
  default?: unknown;
  enumValues?: readonly string[];
}

export class TableBuilder {
  readonly columns: ColumnDefinition[] = [];
  readonly foreignKeys: ForeignKeyDefinition[] = [];
  readonly indexes: IndexDefinition[] = [];
  /** Inline table-level constraints (PRIMARY KEY / UNIQUE). */
  readonly tableConstraints: string[] = [];

  constructor(public readonly name: string) {}

  column(
    name: string,
    type: ColumnDefinition["type"],
    length?: number,
  ): ColumnBuilder {
    const col: ColumnDefinition = {
      name,
      type,
      nullable: false,
      ...(length !== undefined ? { length } : {}),
    };
    this.columns.push(col);
    return new ColumnBuilder(col, this);
  }

  string(name: string, length?: number): ColumnBuilder {
    return this.column(name, "string", length);
  }

  /** Unbounded text (PostgreSQL TEXT, SQLite TEXT). */
  text(name: string): ColumnBuilder {
    return this.column(name, "text");
  }

  integer(name: string): ColumnBuilder {
    return this.column(name, "integer");
  }

  /** 64-bit integer (PostgreSQL BIGINT, SQLite INTEGER). */
  bigInteger(name: string): ColumnBuilder {
    return this.column(name, "bigInteger");
  }

  decimal(name: string): ColumnBuilder {
    return this.column(name, "decimal");
  }

  uuid(name: string): ColumnBuilder {
    return this.column(name, "uuid");
  }

  timestamp(name: string): ColumnBuilder {
    return this.column(name, "timestamp");
  }

  /**
   * A timestamp without time zone (PostgreSQL `TIMESTAMP`).
   *
   * Distinct from {@link timestamp} (`TIMESTAMP WITH TIME ZONE`): the two
   * are not interchangeable — the historical schema declared the former.
   */
  timestampWithoutTimeZone(name: string): ColumnBuilder {
    return this.column(name, "timestampWithoutTimeZone");
  }

  json(name: string): ColumnBuilder {
    return this.column(name, "json");
  }

  boolean(name: string): ColumnBuilder {
    return this.column(name, "boolean");
  }

  /** Floating point number (REAL on both dialects). */
  real(name: string): ColumnBuilder {
    return this.column(name, "real");
  }

  enum(name: string, values: readonly string[]): ColumnBuilder {
    const builder = this.column(name, "enum");
    const writable = builder.col as unknown as WritableColumn;
    writable.enumValues = values;
    return builder;
  }

  foreignKey(
    column: string,
    referencesTable: string,
    referencesColumn: string,
  ): this {
    this.foreignKeys.push({ column, referencesTable, referencesColumn });
    return this;
  }

  index(name: string, columns: readonly string[]): this {
    this.indexes.push({ name, columns });
    return this;
  }

  unique(name: string, columns: readonly string[]): this {
    this.indexes.push({ name, columns, unique: true });
    return this;
  }

  /** Inline `UNIQUE` constraint on a column (`"email" TEXT UNIQUE`). */
  uniqueColumn(name: string): this {
    const col = this.columns.find((c) => c.name === name);
    if (col === undefined) {
      throw new Error(
        `Table "${this.name}": uniqueColumn("${name}") refers to an unknown column.`,
      );
    }
    (col as { unique?: boolean }).unique = true;
    return this;
  }

  /** Inline table-level `UNIQUE` constraint (`UNIQUE ("a", "b")`). */
  uniqueColumns(columns: readonly string[]): this {
    this.tableConstraints.push(
      `UNIQUE (${columns.map((c) => `"${c}"`).join(", ")})`,
    );
    return this;
  }

  /** Inline table-level `PRIMARY KEY` constraint (`PRIMARY KEY ("a", "b")`). */
  primary(columns: readonly string[]): this {
    this.tableConstraints.push(
      `PRIMARY KEY (${columns.map((c) => `"${c}"`).join(", ")})`,
    );
    return this;
  }

  /** Named table-level `CHECK` constraint (`CONSTRAINT "n" CHECK (...)`). */
  check(name: string, condition: string): this {
    this.tableConstraints.push(`CONSTRAINT "${name}" CHECK (${condition})`);
    return this;
  }

  /** Named table-level constraint (`CONSTRAINT "n" <definition>`). */
  constraint(name: string, definition: string): this {
    this.tableConstraints.push(`CONSTRAINT "${name}" ${definition}`);
    return this;
  }
}

export class ColumnBuilder {
  constructor(
    public readonly col: ColumnDefinition,
    private readonly tableBuilder: TableBuilder,
  ) {}

  primary(): this {
    const writable = this.col as unknown as WritableColumn;
    writable.primary = true;
    return this;
  }

  nullable(): this {
    const writable = this.col as unknown as WritableColumn;
    writable.nullable = true;
    return this;
  }

  default(value: unknown): this {
    const writable = this.col as unknown as WritableColumn;
    writable.default = value;
    return this;
  }

  string(name: string, length?: number): ColumnBuilder {
    return this.tableBuilder.string(name, length);
  }

  text(name: string): ColumnBuilder {
    return this.tableBuilder.text(name);
  }

  integer(name: string): ColumnBuilder {
    return this.tableBuilder.integer(name);
  }

  bigInteger(name: string): ColumnBuilder {
    return this.tableBuilder.bigInteger(name);
  }

  decimal(name: string): ColumnBuilder {
    return this.tableBuilder.decimal(name);
  }

  uuid(name: string): ColumnBuilder {
    return this.tableBuilder.uuid(name);
  }

  timestamp(name: string): ColumnBuilder {
    return this.tableBuilder.timestamp(name);
  }

  timestampWithoutTimeZone(name: string): ColumnBuilder {
    return this.tableBuilder.timestampWithoutTimeZone(name);
  }

  json(name: string): ColumnBuilder {
    return this.tableBuilder.json(name);
  }

  boolean(name: string): ColumnBuilder {
    return this.tableBuilder.boolean(name);
  }

  enum(name: string, values: readonly string[]): ColumnBuilder {
    return this.tableBuilder.enum(name, values);
  }

  /** Inline `UNIQUE` constraint on the column (`"email" TEXT UNIQUE`). */
  uniqueInline(): this {
    (this.col as { unique?: boolean }).unique = true;
    return this;
  }

  /** Inline `CHECK` constraint on the column (`CHECK ("qty" > 0)`). */
  check(expression: string): this {
    (this.col as { check?: string }).check = expression;
    return this;
  }

  /** Inline `REFERENCES` constraint (`REFERENCES "users" ("id")`). */
  /**
   * Inline `REFERENCES` constraint on the column
   * (`REFERENCES "users" ("id")`).
   *
   * @param table the referenced table, optionally schema-qualified.
   */
  references(table: string | QualifiedTable, column: string): this {
    const reference = resolveTable(table);
    (this.col as { references?: unknown }).references = {
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      table: reference.name,
      column,
    };
    return this;
  }

  foreignKey(
    column: string,
    referencesTable: string,
    referencesColumn: string,
  ): TableBuilder {
    return this.tableBuilder.foreignKey(
      column,
      referencesTable,
      referencesColumn,
    );
  }

  index(name: string, columns: readonly string[]): TableBuilder {
    return this.tableBuilder.index(name, columns);
  }

  unique(name: string, columns: readonly string[]): TableBuilder {
    return this.tableBuilder.unique(name, columns);
  }
}

export class SchemaBuilder {
  readonly blueprints: Blueprint[] = [];

  createTable(
    name: string,
    fn: (table: TableBuilder) => void,
    options?: { readonly ifNotExists?: boolean; readonly schema?: string },
  ): void {
    const builder = new TableBuilder(name);
    fn(builder);
    this.blueprints.push({
      type: "createTable",
      table: name,
      ...(options?.schema !== undefined ? { schema: options.schema } : {}),
      ...(options?.ifNotExists !== undefined
        ? { ifNotExists: options.ifNotExists }
        : {}),
      columns: builder.columns,
      foreignKeys: builder.foreignKeys,
      indexes: builder.indexes,
      ...(builder.tableConstraints.length > 0
        ? { tableConstraints: builder.tableConstraints }
        : {}),
    });
  }

  dropTable(
    table: string | QualifiedTable,
    options?: { readonly ifExists?: boolean; readonly schema?: string },
  ): void {
    const reference = resolveTable(table);
    this.blueprints.push({
      type: "dropTable",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      ...(options?.ifExists !== undefined
        ? { ifExists: options.ifExists }
        : {}),
    });
  }

  addColumn(
    table: string | QualifiedTable,
    name: string,
    type: ColumnDefinition["type"],
    fn?: (col: ColumnBuilder) => void,
    options?: { readonly ifNotExists?: boolean; readonly length?: number },
  ): void {
    const col: ColumnDefinition = {
      name,
      type,
      nullable: false,
      ...(options?.length !== undefined ? { length: options.length } : {}),
    };
    const reference = resolveTable(table);
    if (fn) {
      const colBuilder = new ColumnBuilder(
        col,
        new TableBuilder(reference.name),
      );
      fn(colBuilder);
    }
    this.blueprints.push({
      type: "addColumn",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      ...(options?.ifNotExists !== undefined
        ? { ifNotExists: options.ifNotExists }
        : {}),
      column: col,
    });
  }

  dropColumn(
    table: string | QualifiedTable,
    column: string,
    options?: { readonly ifExists?: boolean },
  ): void {
    const reference = resolveTable(table);
    this.blueprints.push({
      type: "dropColumn",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      column,
      ...(options?.ifExists !== undefined
        ? { ifExists: options.ifExists }
        : {}),
    });
  }

  renameColumn(table: string | QualifiedTable, from: string, to: string): void {
    const reference = resolveTable(table);
    this.blueprints.push({
      type: "renameColumn",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      from,
      to,
    });
  }

  renameTable(table: string | QualifiedTable, to: string): void {
    const reference = resolveTable(table);
    this.blueprints.push({
      type: "renameTable",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      to,
    });
  }

  /**
   * Creates an index.
   *
   * @param table the indexed table (optionally schema-qualified).
   * @param name the index name.
   * @param columns the indexed columns, with their optional sort direction.
   * @param options unique, `IF NOT EXISTS`, partial index condition.
   */
  createIndex(
    table: string | QualifiedTable,
    name: string,
    columns: readonly IndexColumnRef[],
    options?: CreateIndexOptions,
  ): void {
    const reference = resolveTable(table);
    const normalized = columns.map((column) =>
      typeof column === "string" ? { name: column } : column,
    );
    const where =
      options?.where === undefined
        ? undefined
        : Array.isArray(options.where)
          ? options.where
          : [options.where as Condition];

    this.blueprints.push({
      type: "createIndex",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      name,
      columns: normalized.map((column) => column.name),
      directions: normalized.map((column) => column.direction ?? "asc"),
      ...(options?.unique !== undefined ? { unique: options.unique } : {}),
      ...(options?.ifNotExists !== undefined
        ? { ifNotExists: options.ifNotExists }
        : {}),
      ...(where !== undefined ? { where } : {}),
    });
  }

  /** Creates a schema (PostgreSQL only). */
  createSchema(schema: string): void {
    this.blueprints.push({ type: "createSchema", schema });
  }

  /** Moves a table to another schema (PostgreSQL only). */
  moveTableToSchema(table: string, fromSchema: string, toSchema: string): void {
    this.blueprints.push({
      type: "moveTableToSchema",
      table,
      fromSchema,
      toSchema,
    });
  }

  /** Renames a table inside its schema (PostgreSQL only). */
  renameTableInSchema(schema: string, table: string, to: string): void {
    this.blueprints.push({
      type: "renameTableInSchema",
      schema,
      table,
      to,
    });
  }

  /**
   * Adds a table constraint (PostgreSQL only).
   *
   * @param definition constraint expression, e.g.
   *   `UNIQUE ("targetType", "targetId")` or `CHECK ("quantity" > 0)`.
   */
  addConstraint(table: QualifiedTable, name: string, definition: string): void {
    this.blueprints.push({
      type: "addConstraint",
      ...(table.schema !== undefined ? { schema: table.schema } : {}),
      table: table.name,
      name,
      definition,
    });
  }

  /**
   * Drops a table constraint (PostgreSQL only).
   *
   * @param options `ifExists` emits `ALTER TABLE IF EXISTS …` — the
   *   historical migrations declared it, and it makes the rollback
   *   idempotent when the table is already gone.
   */
  dropConstraint(
    table: QualifiedTable,
    name: string,
    options?: { readonly ifExists?: boolean },
  ): void {
    this.blueprints.push({
      type: "dropConstraint",
      ...(table.schema !== undefined ? { schema: table.schema } : {}),
      table: table.name,
      name,
      ...(options?.ifExists !== undefined
        ? { ifExists: options.ifExists }
        : {}),
    });
  }

  /** Changes the type of a column (PostgreSQL only). */
  alterColumnType(
    table: QualifiedTable,
    column: string,
    columnType: ColumnDefinition["type"],
  ): void {
    this.blueprints.push({
      type: "alterColumnType",
      ...(table.schema !== undefined ? { schema: table.schema } : {}),
      table: table.name,
      column,
      columnType,
    });
  }

  /**
   * Changes the default of a column (PostgreSQL only).
   * An undefined value drops the default.
   */
  alterColumnDefault(
    table: QualifiedTable,
    column: string,
    value?: unknown,
  ): void {
    this.blueprints.push({
      type: "alterColumnDefault",
      ...(table.schema !== undefined ? { schema: table.schema } : {}),
      table: table.name,
      column,
      ...(value !== undefined ? { value } : {}),
    });
  }

  /** Changes the nullability of a column (PostgreSQL only). */
  alterColumnNullable(
    table: QualifiedTable,
    column: string,
    nullable: boolean,
  ): void {
    this.blueprints.push({
      type: "alterColumnNullable",
      ...(table.schema !== undefined ? { schema: table.schema } : {}),
      table: table.name,
      column,
      nullable,
    });
  }

  /** Drops an index (PostgreSQL only). */
  dropIndex(name: string, schema?: string): void {
    this.blueprints.push({
      type: "dropIndex",
      ...(schema !== undefined ? { schema } : {}),
      name,
    });
  }

  /**
   * Creates (or replaces) a database function (PostgreSQL only).
   *
   * The engine owns the command; the migration owns the body of the
   * function — PL/pgSQL code, never a SQL command.
   */
  createFunction(
    name: string,
    definition: TrustedFunctionBody,
    options?: {
      readonly schema?: string;
      readonly returns?: string;
      readonly language?: string;
      readonly replace?: boolean;
    },
  ): void {
    this.blueprints.push({
      type: "createFunction",
      ...(options?.schema !== undefined ? { schema: options.schema } : {}),
      name,
      definition,
      ...(options?.returns !== undefined ? { returns: options.returns } : {}),
      ...(options?.language !== undefined
        ? { language: options.language }
        : {}),
      ...(options?.replace !== undefined ? { replace: options.replace } : {}),
    });
  }

  /** Creates a trigger (PostgreSQL only). */
  createTrigger(
    name: string,
    table: string,
    events: readonly CreateTriggerBlueprint["events"][number][],
    timing: CreateTriggerBlueprint["timing"],
    fn: string,
    options?: {
      readonly schema?: string;
      readonly forEachRow?: boolean;
      readonly when?: string;
      readonly functionSchema?: string;
    },
  ): void {
    this.blueprints.push({
      type: "createTrigger",
      ...(options?.schema !== undefined ? { schema: options.schema } : {}),
      name,
      table,
      timing,
      events,
      ...(options?.forEachRow !== undefined
        ? { forEachRow: options.forEachRow }
        : {}),
      function: fn,
      ...(options?.functionSchema !== undefined
        ? { functionSchema: options.functionSchema }
        : {}),
      ...(options?.when !== undefined ? { when: options.when } : {}),
    });
  }

  /** Drops a trigger (PostgreSQL only). */
  dropTrigger(
    name: string,
    table: string,
    options?: { readonly schema?: string },
  ): void {
    this.blueprints.push({
      type: "dropTrigger",
      ...(options?.schema !== undefined ? { schema: options.schema } : {}),
      name,
      table,
    });
  }

  /** Drops a database function (PostgreSQL only). */
  dropFunction(name: string, options?: { readonly schema?: string }): void {
    this.blueprints.push({
      type: "dropFunction",
      ...(options?.schema !== undefined ? { schema: options.schema } : {}),
      name,
    });
  }

  /** Filtre les blueprints qui concernent la table donnée. */
  tableStatements(tableName: string): Blueprint[] {
    return this.blueprints.filter((bp) => {
      if (bp.type === "createTable") return bp.table === tableName;
      if (bp.type === "addColumn" || bp.type === "dropColumn") {
        return bp.table === tableName;
      }
      if (bp.type === "renameColumn" || bp.type === "renameTable") {
        return (
          bp.table === tableName || (bp as { to?: string }).to === tableName
        );
      }
      if (bp.type === "createIndex") return bp.table === tableName;
      if (bp.type === "dropTable") return bp.table === tableName;
      return false;
    });
  }

  /**
   * Compile tous les blueprints enregistrés avec la `Grammar` fournie et
   * retourne la liste aplatie des `SqlStatement`.
   */
  compile(grammar: Grammar): readonly SqlStatement[] {
    const statements: SqlStatement[] = [];
    for (const bp of this.blueprints) {
      for (const stmt of grammar.compile(bp)) {
        statements.push(stmt);
      }
    }
    return statements;
  }
}
