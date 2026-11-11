import type {
  Blueprint,
  ColumnDefinition,
  CreateIndexBlueprint,
  CreateTableBlueprint,
} from "./schema-builder.js";
import {
  renderConditions,
  renderExpression,
  renderSelectBody,
} from "./expression-renderer.js";
import type { Expression } from "./expressions.js";
import { value as literalValue } from "./expressions.js";

/** Normalizes a raw value into an expression. */
function toExpression(raw: unknown): Expression {
  if (typeof raw === "object" && raw !== null && "kind" in raw) {
    return raw as Expression;
  }
  return literalValue(raw);
}

export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export interface Grammar {
  readonly dialect: "sqlite" | "postgres";
  compile(blueprint: Blueprint): readonly SqlStatement[];
}

export class SQLiteGrammar implements Grammar {
  readonly dialect: "sqlite" | "postgres" = "sqlite";

  /** Renders `"schema"."table"` or `"table"`. */
  private renderQualifiedTable(
    schema: string | undefined,
    table: string,
  ): string {
    return schema !== undefined ? `"${schema}"."${table}"` : `"${table}"`;
  }

  compile(blueprint: Blueprint): readonly SqlStatement[] {
    switch (blueprint.type) {
      case "createTable":
        return this.createTable(blueprint);
      case "dropTable":
        return [
          {
            sql: `DROP TABLE ${blueprint.ifExists ? "IF EXISTS " : ""}${this.renderQualifiedTable(blueprint.schema, blueprint.table)};`,
            params: [],
          },
        ];
      case "addColumn":
        return this.addColumn(
          blueprint.table,
          blueprint.column,
          blueprint.schema,
          blueprint.ifNotExists,
        );
      case "dropColumn":
        // SQLite doesn't support DROP COLUMN on some legacy versions, but modern SQLite (>=3.35.0) supports:
        // ALTER TABLE table DROP COLUMN column
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} DROP COLUMN "${blueprint.column}";`,
            params: [],
          },
        ];
      case "renameColumn":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} RENAME COLUMN "${blueprint.from}" TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "renameTable":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} RENAME TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "createIndex": {
        const unique = blueprint.unique ? "UNIQUE " : "";
        const ifNotExists = blueprint.ifNotExists ? "IF NOT EXISTS " : "";
        return [
          {
            sql: `CREATE ${unique}INDEX ${ifNotExists}"${blueprint.name}" ON "${blueprint.table}" (${blueprint.columns.map((c) => `"${c}"`).join(", ")});`,
            params: [],
          },
        ];
      }
      case "createSchema":
      case "moveTableToSchema":
      case "renameTableInSchema":
      case "addConstraint":
      case "dropConstraint":
      case "alterColumnType":
      case "alterColumnDefault":
      case "alterColumnNullable":
      case "dropIndex":
      case "createFunction":
      case "createTrigger":
      case "dropTrigger":
      case "dropFunction":
        // SQLite has no schema, no table constraints, no ALTER COLUMN and
        // no trigger functions. Failing fast is the contract: such a
        // migration is dialect-specific.
        throw new Error(
          `Unsupported blueprint type on sqlite: ${(blueprint as unknown as { type: string }).type}`,
        );
      case "insertRow": {
        const columns = Object.keys(blueprint.row);
        const context = { params: [] as unknown[] };
        const values = columns.map((column) =>
          renderExpression(toExpression(blueprint.row[column]!), context),
        );
        const conflict = blueprint.onConflictIgnore
          ? " ON CONFLICT DO NOTHING"
          : "";
        return [
          {
            sql: `INSERT INTO ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})${conflict};`,
            params: context.params,
          },
        ];
      }
      case "insertSelect": {
        const context = { params: [] as unknown[] };
        // `INSERT INTO … SELECT …` — the query is not parenthesized (a
        // subquery would be a scalar expression).
        const select = renderSelectBody(blueprint.select, context);
        const conflict = blueprint.onConflictIgnore
          ? " ON CONFLICT DO NOTHING"
          : "";
        return [
          {
            sql: `INSERT INTO ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} (${blueprint.columns.map((c) => `"${c}"`).join(", ")}) ${select}${conflict};`,
            params: context.params,
          },
        ];
      }
      case "updateRow": {
        const context = { params: [] as unknown[] };
        const assignments = Object.entries(blueprint.assignments).map(
          ([column, raw]) =>
            `"${column}" = ${renderExpression(toExpression(raw!), context)}`,
        );
        const conditions = renderConditions(blueprint.where, context);
        return [
          {
            sql: `UPDATE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} SET ${assignments.join(", ")} WHERE ${conditions};`,
            params: context.params,
          },
        ];
      }
      case "deleteRow": {
        const context = { params: [] as unknown[] };
        const conditions = renderConditions(blueprint.where, context);
        return [
          {
            sql: `DELETE FROM ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} WHERE ${conditions};`,
            params: context.params,
          },
        ];
      }
      default:
        throw new Error(
          `Unsupported blueprint type: ${(blueprint as unknown as { type: string }).type}`,
        );
    }
  }

  private createTable(bp: CreateTableBlueprint): readonly SqlStatement[] {
    const definitions: string[] = [];

    for (const col of bp.columns) {
      definitions.push(this.compileColumn(col));
    }

    for (const fk of bp.foreignKeys) {
      definitions.push(
        `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.referencesTable}" ("${fk.referencesColumn}")`,
      );
    }

    for (const constraint of bp.tableConstraints ?? []) {
      definitions.push(constraint);
    }

    const ifNotExists = bp.ifNotExists ? "IF NOT EXISTS " : "";
    const statements: SqlStatement[] = [
      {
        sql: `CREATE TABLE ${ifNotExists}${this.renderQualifiedTable(bp.schema, bp.table)} (\n  ${definitions.join(",\n  ")}\n);`,
        params: [],
      },
    ];

    for (const idx of bp.indexes) {
      const unique = idx.unique ? "UNIQUE " : "";
      statements.push({
        sql: `CREATE ${unique}INDEX "${idx.name}" ON "${bp.table}" (${idx.columns.map((c) => `"${c}"`).join(", ")});`,
        params: [],
      });
    }

    return statements;
  }

  private compileColumn(col: ColumnDefinition): string {
    const parts: string[] = [`"${col.name}"`];

    switch (col.type) {
      case "string":
        parts.push("TEXT");
        break;
      case "text":
        parts.push("TEXT");
        break;
      case "integer":
        parts.push("INTEGER");
        break;
      case "bigInteger":
        parts.push("INTEGER");
        break;
      case "decimal":
        parts.push("NUMERIC");
        break;
      case "real":
        parts.push("REAL");
        break;
      case "uuid":
        parts.push("TEXT");
        break;
      case "timestamp":
        parts.push("TEXT");
        break;
      case "timestampWithoutTimeZone":
        parts.push("TEXT");
        break;
      case "json":
        parts.push("TEXT");
        break;
      case "boolean":
        parts.push("INTEGER");
        break;
      case "enum":
        parts.push("TEXT");
        break;
      default:
        parts.push("TEXT");
    }

    if (col.primary) {
      parts.push("PRIMARY KEY");
    }

    if (!col.nullable) {
      parts.push("NOT NULL");
    }

    if (col.unique) {
      parts.push("UNIQUE");
    }

    if (col.check !== undefined) {
      parts.push(`CHECK (${col.check})`);
    }

    if (col.references !== undefined) {
      parts.push(
        `REFERENCES ${
          col.references.schema !== undefined
            ? `"${col.references.schema}"."${col.references.table}"`
            : `"${col.references.table}"`
        } ("${col.references.column}")`,
      );
    }

    if (col.default !== undefined) {
      parts.push(`DEFAULT ${this.formatValue(col.default)}`);
    }

    if (col.type === "enum" && col.enumValues && col.enumValues.length > 0) {
      const values = col.enumValues.map((v) => `'${v}'`).join(", ");
      parts.push(`CHECK ("${col.name}" IN (${values}))`);
    }

    return parts.join(" ");
  }

  private addColumn(
    table: string,
    col: ColumnDefinition,
    schema?: string,
    ifNotExists?: boolean,
  ): readonly SqlStatement[] {
    const ifNotExistsSql = ifNotExists ? "IF NOT EXISTS " : "";
    return [
      {
        sql: `ALTER TABLE ${this.renderQualifiedTable(schema, table)} ADD COLUMN ${ifNotExistsSql}${this.compileColumn(col)};`,
        params: [],
      },
    ];
  }

  private formatValue(value: unknown): string {
    if (typeof value === "string") {
      return `'${value}'`;
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (value === null) {
      return "NULL";
    }
    return String(value);
  }
}

export class PostgresGrammar implements Grammar {
  readonly dialect: "sqlite" | "postgres" = "postgres";

  compile(blueprint: Blueprint): readonly SqlStatement[] {
    switch (blueprint.type) {
      case "createTable":
        return this.createTable(blueprint);
      case "dropTable":
        return [
          {
            sql: `DROP TABLE ${blueprint.ifExists ? "IF EXISTS " : ""}${this.renderQualifiedTable(blueprint.schema, blueprint.table)} CASCADE;`,
            params: [],
          },
        ];
      case "addColumn":
        return this.addColumn(
          blueprint.table,
          blueprint.column,
          blueprint.schema,
          blueprint.ifNotExists,
        );
      case "dropColumn":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} DROP COLUMN ${blueprint.ifExists ? "IF EXISTS " : ""}"${blueprint.column}";`,
            params: [],
          },
        ];
      case "renameColumn":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} RENAME COLUMN "${blueprint.from}" TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "renameTable":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} RENAME TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "createIndex": {
        const unique = blueprint.unique ? "UNIQUE " : "";
        const ifNotExists = blueprint.ifNotExists ? "IF NOT EXISTS " : "";
        const context = { params: [] as unknown[] };
        const where =
          blueprint.where !== undefined && blueprint.where.length > 0
            ? ` WHERE ${renderConditions(blueprint.where, context)}`
            : "";
        return [
          {
            sql: `CREATE ${unique}INDEX ${ifNotExists}"${blueprint.name}" ON ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} (${this.renderIndexColumns(blueprint)})${where};`,
            params: context.params,
          },
        ];
      }
      case "createSchema":
        return [
          {
            sql: `CREATE SCHEMA IF NOT EXISTS "${blueprint.schema}";`,
            params: [],
          },
        ];
      case "moveTableToSchema":
        return [
          {
            sql: `ALTER TABLE IF EXISTS "${blueprint.fromSchema}"."${blueprint.table}" SET SCHEMA "${blueprint.toSchema}";`,
            params: [],
          },
        ];
      case "renameTableInSchema":
        return [
          {
            sql: `ALTER TABLE IF EXISTS "${blueprint.schema}"."${blueprint.table}" RENAME TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "addConstraint":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} ADD CONSTRAINT "${blueprint.name}" ${blueprint.definition};`,
            params: [],
          },
        ];
      case "dropConstraint":
        return [
          {
            sql: `ALTER TABLE ${blueprint.ifExists ? "IF EXISTS " : ""}${this.renderQualifiedTable(blueprint.schema, blueprint.table)} DROP CONSTRAINT IF EXISTS "${blueprint.name}";`,
            params: [],
          },
        ];
      case "alterColumnType":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} ALTER COLUMN "${blueprint.column}" TYPE ${this.renderColumnType(blueprint.columnType)};`,
            params: [],
          },
        ];
      case "alterColumnDefault":
        return [
          {
            sql:
              blueprint.value === undefined
                ? `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} ALTER COLUMN "${blueprint.column}" DROP DEFAULT;`
                : `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} ALTER COLUMN "${blueprint.column}" SET DEFAULT ${this.formatValue(blueprint.value)};`,
            params: [],
          },
        ];
      case "alterColumnNullable":
        return [
          {
            sql: `ALTER TABLE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} ALTER COLUMN "${blueprint.column}" ${blueprint.nullable ? "DROP NOT NULL" : "SET NOT NULL"};`,
            params: [],
          },
        ];
      case "dropIndex":
        return [
          {
            sql: `DROP INDEX IF EXISTS ${this.renderQualifiedTable(blueprint.schema, blueprint.name)};`,
            params: [],
          },
        ];
      case "createFunction": {
        const replace = blueprint.replace ? "OR REPLACE " : "";
        const returns =
          blueprint.returns !== undefined
            ? ` RETURNS ${blueprint.returns}`
            : "";
        const language =
          blueprint.language !== undefined
            ? ` LANGUAGE ${blueprint.language}`
            : "";
        return [
          {
            sql: `CREATE ${replace}FUNCTION ${this.renderQualifiedTable(blueprint.schema, blueprint.name)}()${returns} AS $$${blueprint.definition}$$${language};`,
            params: [],
          },
        ];
      }
      case "createTrigger": {
        const forEachRow = blueprint.forEachRow ? " FOR EACH ROW" : "";
        const when =
          blueprint.when !== undefined ? ` WHEN (${blueprint.when})` : "";
        const events = blueprint.events
          .map((event) => event.toUpperCase())
          .join(" OR ");
        return [
          {
            sql: `CREATE TRIGGER "${blueprint.name}" ${blueprint.timing.toUpperCase()} ${events} ON ${this.renderQualifiedTable(blueprint.schema, blueprint.table)}${forEachRow}${when} EXECUTE FUNCTION ${this.renderQualifiedTable(blueprint.functionSchema ?? blueprint.schema, blueprint.function)}();`,
            params: [],
          },
        ];
      }
      case "dropTrigger":
        return [
          {
            sql: `DROP TRIGGER IF EXISTS "${blueprint.name}" ON ${this.renderQualifiedTable(blueprint.schema, blueprint.table)};`,
            params: [],
          },
        ];
      case "dropFunction":
        return [
          {
            sql: `DROP FUNCTION IF EXISTS ${this.renderQualifiedTable(blueprint.schema, blueprint.name)}();`,
            params: [],
          },
        ];
      case "insertRow": {
        const columns = Object.keys(blueprint.row);
        const context = { params: [] as unknown[] };
        const values = columns.map((column) =>
          renderExpression(toExpression(blueprint.row[column]!), context),
        );
        const conflict = blueprint.onConflictIgnore
          ? " ON CONFLICT DO NOTHING"
          : "";
        return [
          {
            sql: `INSERT INTO ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})${conflict};`,
            params: context.params,
          },
        ];
      }
      case "insertSelect": {
        const context = { params: [] as unknown[] };
        // `INSERT INTO … SELECT …` — the query is not parenthesized (a
        // subquery would be a scalar expression).
        const select = renderSelectBody(blueprint.select, context);
        const conflict = blueprint.onConflictIgnore
          ? " ON CONFLICT DO NOTHING"
          : "";
        return [
          {
            sql: `INSERT INTO ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} (${blueprint.columns.map((c) => `"${c}"`).join(", ")}) ${select}${conflict};`,
            params: context.params,
          },
        ];
      }
      case "updateRow": {
        const context = { params: [] as unknown[] };
        const assignments = Object.entries(blueprint.assignments).map(
          ([column, raw]) =>
            `"${column}" = ${renderExpression(toExpression(raw!), context)}`,
        );
        const conditions = renderConditions(blueprint.where, context);
        return [
          {
            sql: `UPDATE ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} SET ${assignments.join(", ")} WHERE ${conditions};`,
            params: context.params,
          },
        ];
      }
      case "deleteRow": {
        const context = { params: [] as unknown[] };
        const conditions = renderConditions(blueprint.where, context);
        return [
          {
            sql: `DELETE FROM ${this.renderQualifiedTable(blueprint.schema, blueprint.table)} WHERE ${conditions};`,
            params: context.params,
          },
        ];
      }
      default:
        throw new Error(
          `Unsupported blueprint type: ${(blueprint as unknown as { type: string }).type}`,
        );
    }
  }

  /** Renders `"schema"."table"` or `"table"`. */
  private renderQualifiedTable(
    schema: string | undefined,
    table: string,
  ): string {
    return schema !== undefined ? `"${schema}"."${table}"` : `"${table}"`;
  }

  /** Renders the column list of an index, with its sort directions. */
  private renderIndexColumns(blueprint: CreateIndexBlueprint): string {
    return blueprint.columns
      .map((column, index) => {
        const direction = blueprint.directions?.[index];
        return direction === "desc" ? `"${column}" DESC` : `"${column}"`;
      })
      .join(", ");
  }

  /** Renders the SQL type of a column (PostgreSQL). */
  private renderColumnType(type: ColumnDefinition["type"]): string {
    switch (type) {
      case "string":
        return "VARCHAR(255)";
      case "text":
        return "TEXT";
      case "integer":
        return "INTEGER";
      case "bigInteger":
        return "BIGINT";
      case "decimal":
        return "DECIMAL(12,2)";
      case "uuid":
        return "UUID";
      case "timestamp":
        return "TIMESTAMP WITH TIME ZONE";
      case "timestampWithoutTimeZone":
        return "TIMESTAMP";
      case "json":
        return "JSONB";
      case "boolean":
        return "BOOLEAN";
      case "enum":
        return "VARCHAR(50)";
      default:
        return "TEXT";
    }
  }

  private createTable(bp: CreateTableBlueprint): readonly SqlStatement[] {
    const definitions: string[] = [];

    for (const col of bp.columns) {
      definitions.push(this.compileColumn(col));
    }

    for (const fk of bp.foreignKeys) {
      definitions.push(
        `CONSTRAINT "fk_${bp.table}_${fk.column}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.referencesTable}" ("${fk.referencesColumn}") ON DELETE CASCADE`,
      );
    }

    for (const constraint of bp.tableConstraints ?? []) {
      definitions.push(constraint);
    }

    const ifNotExists = bp.ifNotExists ? "IF NOT EXISTS " : "";
    const statements: SqlStatement[] = [
      {
        sql: `CREATE TABLE ${ifNotExists}${this.renderQualifiedTable(bp.schema, bp.table)} (\n  ${definitions.join(",\n  ")}\n);`,
        params: [],
      },
    ];

    for (const idx of bp.indexes) {
      const unique = idx.unique ? "UNIQUE " : "";
      statements.push({
        sql: `CREATE ${unique}INDEX "${idx.name}" ON "${bp.table}" (${idx.columns.map((c) => `"${c}"`).join(", ")});`,
        params: [],
      });
    }

    return statements;
  }

  private compileColumn(col: ColumnDefinition): string {
    const parts: string[] = [`"${col.name}"`];

    switch (col.type) {
      case "string":
        parts.push(
          col.length !== undefined ? `VARCHAR(${col.length})` : "VARCHAR(255)",
        );
        break;
      case "text":
        parts.push("TEXT");
        break;
      case "integer":
        parts.push("INTEGER");
        break;
      case "bigInteger":
        parts.push("BIGINT");
        break;
      case "decimal":
        parts.push("DECIMAL(12,2)");
        break;
      case "real":
        parts.push("REAL");
        break;
      case "uuid":
        parts.push("UUID");
        break;
      case "timestamp":
        parts.push("TIMESTAMP WITH TIME ZONE");
        break;
      case "timestampWithoutTimeZone":
        parts.push("TIMESTAMP");
        break;
      case "json":
        parts.push("JSONB");
        break;
      case "boolean":
        parts.push("BOOLEAN");
        break;
      case "enum":
        parts.push("VARCHAR(50)");
        break;
      default:
        parts.push("TEXT");
    }

    if (col.primary) {
      parts.push("PRIMARY KEY");
    }

    if (!col.nullable) {
      parts.push("NOT NULL");
    }

    if (col.unique) {
      parts.push("UNIQUE");
    }

    if (col.check !== undefined) {
      parts.push(`CHECK (${col.check})`);
    }

    if (col.references !== undefined) {
      parts.push(
        `REFERENCES ${
          col.references.schema !== undefined
            ? `"${col.references.schema}"."${col.references.table}"`
            : `"${col.references.table}"`
        } ("${col.references.column}")`,
      );
    }

    if (col.default !== undefined) {
      parts.push(`DEFAULT ${this.formatValue(col.default)}`);
    }

    if (col.type === "enum" && col.enumValues && col.enumValues.length > 0) {
      const values = col.enumValues.map((v) => `'${v}'`).join(", ");
      parts.push(`CHECK ("${col.name}" IN (${values}))`);
    }

    return parts.join(" ");
  }

  private addColumn(
    table: string,
    col: ColumnDefinition,
    schema?: string,
    ifNotExists?: boolean,
  ): readonly SqlStatement[] {
    const ifNotExistsSql = ifNotExists ? "IF NOT EXISTS " : "";
    return [
      {
        sql: `ALTER TABLE ${this.renderQualifiedTable(schema, table)} ADD COLUMN ${ifNotExistsSql}${this.compileColumn(col)};`,
        params: [],
      },
    ];
  }

  private formatValue(value: unknown): string {
    if (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      (value as { kind: string }).kind !== "literal"
    ) {
      // A structured expression (a function call, a cast, …): rendered by the
      // expression renderer so that `DEFAULT now()` stays `DEFAULT now()`.
      const context = { params: [] as unknown[] };
      return renderExpression(value as Expression, context);
    }
    if (typeof value === "string") {
      return `'${value}'`;
    }
    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }
    if (value === null) {
      return "NULL";
    }
    return String(value);
  }
}
