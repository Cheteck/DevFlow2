/**
 * SchemaBuilder — Core Blueprint AST and fluent DSL for schema alterations.
 * Aligned with PRD-0006 §Phase 2 requirements.
 */

export interface ColumnDefinition {
  readonly name: string;
  readonly type:
    | "string"
    | "integer"
    | "decimal"
    | "uuid"
    | "timestamp"
    | "json"
    | "enum"
    | "boolean";
  readonly primary?: boolean;
  readonly nullable?: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
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
  readonly columns: readonly ColumnDefinition[];
  readonly foreignKeys: readonly ForeignKeyDefinition[];
  readonly indexes: readonly IndexDefinition[];
}

export interface DropTableBlueprint {
  readonly type: "dropTable";
  readonly table: string;
}

export interface AddColumnBlueprint {
  readonly type: "addColumn";
  readonly table: string;
  readonly column: ColumnDefinition;
}

export interface DropColumnBlueprint {
  readonly type: "dropColumn";
  readonly table: string;
  readonly column: string;
}

export interface RenameColumnBlueprint {
  readonly type: "renameColumn";
  readonly table: string;
  readonly from: string;
  readonly to: string;
}

export interface RenameTableBlueprint {
  readonly type: "renameTable";
  readonly table: string;
  readonly to: string;
}

export interface CreateIndexBlueprint {
  readonly type: "createIndex";
  readonly table: string;
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
}

export type Blueprint =
  | CreateTableBlueprint
  | DropTableBlueprint
  | AddColumnBlueprint
  | DropColumnBlueprint
  | RenameColumnBlueprint
  | RenameTableBlueprint
  | CreateIndexBlueprint;

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

  constructor(public readonly name: string) {}

  column(name: string, type: ColumnDefinition["type"]): ColumnBuilder {
    const col: ColumnDefinition = { name, type, nullable: false };
    this.columns.push(col);
    return new ColumnBuilder(col, this);
  }

  string(name: string): ColumnBuilder {
    return this.column(name, "string");
  }

  integer(name: string): ColumnBuilder {
    return this.column(name, "integer");
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

  json(name: string): ColumnBuilder {
    return this.column(name, "json");
  }

  boolean(name: string): ColumnBuilder {
    return this.column(name, "boolean");
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

  string(name: string): ColumnBuilder {
    return this.tableBuilder.string(name);
  }

  integer(name: string): ColumnBuilder {
    return this.tableBuilder.integer(name);
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

  json(name: string): ColumnBuilder {
    return this.tableBuilder.json(name);
  }

  boolean(name: string): ColumnBuilder {
    return this.tableBuilder.boolean(name);
  }

  enum(name: string, values: readonly string[]): ColumnBuilder {
    return this.tableBuilder.enum(name, values);
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

interface WritableCreateIndex {
  type: "createIndex";
  table: string;
  name: string;
  columns: readonly string[];
  unique?: boolean;
}

export class SchemaBuilder {
  readonly blueprints: Blueprint[] = [];

  createTable(name: string, fn: (table: TableBuilder) => void): void {
    const builder = new TableBuilder(name);
    fn(builder);
    this.blueprints.push({
      type: "createTable",
      table: name,
      columns: builder.columns,
      foreignKeys: builder.foreignKeys,
      indexes: builder.indexes,
    });
  }

  dropTable(name: string): void {
    this.blueprints.push({
      type: "dropTable",
      table: name,
    });
  }

  addColumn(
    table: string,
    name: string,
    type: ColumnDefinition["type"],
    fn?: (col: ColumnBuilder) => void,
  ): void {
    const col: ColumnDefinition = { name, type, nullable: false };
    if (fn) {
      const colBuilder = new ColumnBuilder(col, new TableBuilder(table));
      fn(colBuilder);
    }
    this.blueprints.push({
      type: "addColumn",
      table,
      column: col,
    });
  }

  dropColumn(table: string, column: string): void {
    this.blueprints.push({
      type: "dropColumn",
      table,
      column,
    });
  }

  renameColumn(table: string, from: string, to: string): void {
    this.blueprints.push({
      type: "renameColumn",
      table,
      from,
      to,
    });
  }

  renameTable(table: string, to: string): void {
    this.blueprints.push({
      type: "renameTable",
      table,
      to,
    });
  }

  createIndex(
    table: string,
    name: string,
    columns: readonly string[],
    unique?: boolean,
  ): void {
    const bp: WritableCreateIndex = {
      type: "createIndex",
      table,
      name,
      columns,
    };
    if (unique !== undefined) {
      bp.unique = unique;
    }
    this.blueprints.push(bp as unknown as CreateIndexBlueprint);
  }
}
