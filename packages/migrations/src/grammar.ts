import type {
  Blueprint,
  ColumnDefinition,
  CreateTableBlueprint,
} from "./schema-builder";

export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export interface Grammar {
  compile(blueprint: Blueprint): readonly SqlStatement[];
}

export class SQLiteGrammar implements Grammar {
  compile(blueprint: Blueprint): readonly SqlStatement[] {
    switch (blueprint.type) {
      case "createTable":
        return this.createTable(blueprint);
      case "dropTable":
        return [{ sql: `DROP TABLE "${blueprint.table}";`, params: [] }];
      case "addColumn":
        return this.addColumn(blueprint.table, blueprint.column);
      case "dropColumn":
        // SQLite doesn't support DROP COLUMN on some legacy versions, but modern SQLite (>=3.35.0) supports:
        // ALTER TABLE table DROP COLUMN column
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" DROP COLUMN "${blueprint.column}";`,
            params: [],
          },
        ];
      case "renameColumn":
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" RENAME COLUMN "${blueprint.from}" TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "renameTable":
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" RENAME TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "createIndex": {
        const unique = blueprint.unique ? "UNIQUE " : "";
        return [
          {
            sql: `CREATE ${unique}INDEX "${blueprint.name}" ON "${blueprint.table}" (${blueprint.columns.map((c) => `"${c}"`).join(", ")});`,
            params: [],
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

    const statements: SqlStatement[] = [
      {
        sql: `CREATE TABLE "${bp.table}" (\n  ${definitions.join(",\n  ")}\n);`,
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
      case "integer":
        parts.push("INTEGER");
        break;
      case "decimal":
        parts.push("NUMERIC");
        break;
      case "uuid":
        parts.push("TEXT");
        break;
      case "timestamp":
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
  ): readonly SqlStatement[] {
    return [
      {
        sql: `ALTER TABLE "${table}" ADD COLUMN ${this.compileColumn(col)};`,
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
  compile(blueprint: Blueprint): readonly SqlStatement[] {
    switch (blueprint.type) {
      case "createTable":
        return this.createTable(blueprint);
      case "dropTable":
        return [
          { sql: `DROP TABLE "${blueprint.table}" CASCADE;`, params: [] },
        ];
      case "addColumn":
        return this.addColumn(blueprint.table, blueprint.column);
      case "dropColumn":
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" DROP COLUMN "${blueprint.column}";`,
            params: [],
          },
        ];
      case "renameColumn":
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" RENAME COLUMN "${blueprint.from}" TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "renameTable":
        return [
          {
            sql: `ALTER TABLE "${blueprint.table}" RENAME TO "${blueprint.to}";`,
            params: [],
          },
        ];
      case "createIndex": {
        const unique = blueprint.unique ? "UNIQUE " : "";
        return [
          {
            sql: `CREATE ${unique}INDEX "${blueprint.name}" ON "${blueprint.table}" (${blueprint.columns.map((c) => `"${c}"`).join(", ")});`,
            params: [],
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
        `CONSTRAINT "fk_${bp.table}_${fk.column}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.referencesTable}" ("${fk.referencesColumn}") ON DELETE CASCADE`,
      );
    }

    const statements: SqlStatement[] = [
      {
        sql: `CREATE TABLE "${bp.table}" (\n  ${definitions.join(",\n  ")}\n);`,
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
        parts.push("VARCHAR(255)");
        break;
      case "integer":
        parts.push("INTEGER");
        break;
      case "decimal":
        parts.push("DECIMAL(12,2)");
        break;
      case "uuid":
        parts.push("UUID");
        break;
      case "timestamp":
        parts.push("TIMESTAMP WITH TIME ZONE");
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
  ): readonly SqlStatement[] {
    return [
      {
        sql: `ALTER TABLE "${table}" ADD COLUMN ${this.compileColumn(col)};`,
        params: [],
      },
    ];
  }

  private formatValue(value: unknown): string {
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
