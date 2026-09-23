/**
 * QueryBuilder — Type-Safe DML Query Builder for MosaiX DatabasePort
 * Supports parameter binding ($1, $2 for Postgres, ? for SQLite) with full SQL injection protection.
 */

import type { DatabasePort, Dialect } from "./index.js";

export type ComparisonOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";

export interface WhereCondition {
  readonly column: string;
  readonly operator: ComparisonOperator;
  readonly value?: unknown;
  readonly connector: "AND" | "OR";
}

function quoteIdentifier(id: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
    throw new Error(`Invalid SQL identifier: ${id}`);
  }
  return `"${id}"`;
}

function formatPlaceholder(index: number, dialect: Dialect): string {
  return dialect === "postgres" ? `$${index}` : "?";
}

export class SelectQueryBuilder<T = Record<string, unknown>> {
  private tableName = "";
  private columns: string[] = ["*"];
  private conditions: WhereCondition[] = [];
  private orderBys: { column: string; direction: "ASC" | "DESC" }[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  select(...cols: string[]): this {
    if (cols.length > 0) {
      this.columns = cols;
    }
    return this;
  }

  from(table: string): this {
    this.tableName = table;
    return this;
  }

  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.conditions.push({ column, operator, value, connector: "AND" });
    return this;
  }

  andWhere(column: string, operator: ComparisonOperator, value?: unknown): this {
    return this.where(column, operator, value);
  }

  orWhere(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.conditions.push({ column, operator, value, connector: "OR" });
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderBys.push({ column, direction });
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  offset(n: number): this {
    this.offsetValue = n;
    return this;
  }

  toSql(dialect: Dialect = "sqlite"): { sql: string; params: unknown[] } {
    if (!this.tableName) {
      throw new Error("SelectQueryBuilder requires a table name via .from(table)");
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    const formattedCols = this.columns.includes("*")
      ? "*"
      : this.columns.map(quoteIdentifier).join(", ");

    let sql = `SELECT ${formattedCols} FROM ${quoteIdentifier(this.tableName)}`;

    if (this.conditions.length > 0) {
      const whereParts: string[] = [];
      for (let i = 0; i < this.conditions.length; i++) {
        const cond = this.conditions[i];
        const prefix = i === 0 ? "" : ` ${cond.connector} `;
        const colQuoted = quoteIdentifier(cond.column);

        if (cond.operator === "IS NULL" || cond.operator === "IS NOT NULL") {
          whereParts.push(`${prefix}${colQuoted} ${cond.operator}`);
        } else if (cond.operator === "IN" && Array.isArray(cond.value)) {
          const inPlaceholders = cond.value.map(() => {
            const ph = formatPlaceholder(paramIndex++, dialect);
            return ph;
          });
          params.push(...cond.value);
          whereParts.push(`${prefix}${colQuoted} IN (${inPlaceholders.join(", ")})`);
        } else {
          const ph = formatPlaceholder(paramIndex++, dialect);
          params.push(cond.value);
          whereParts.push(`${prefix}${colQuoted} ${cond.operator} ${ph}`);
        }
      }
      sql += ` WHERE ${whereParts.join("")}`;
    }

    if (this.orderBys.length > 0) {
      const orderParts = this.orderBys.map(
        (o) => `${quoteIdentifier(o.column)} ${o.direction}`
      );
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }

    if (typeof this.limitValue === "number") {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (typeof this.offsetValue === "number") {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  async execute(db: DatabasePort): Promise<T[]> {
    const { sql, params } = this.toSql(db.capabilities.dialect);
    return db.query<T>(sql, params);
  }

  async executeOne(db: DatabasePort): Promise<T | null> {
    const rows = await this.limit(1).execute(db);
    return rows.length > 0 ? rows[0] : null;
  }
}

export class InsertQueryBuilder<_T = Record<string, unknown>> {
  private tableName = "";
  private records: Record<string, unknown>[] = [];

  into(table: string): this {
    this.tableName = table;
    return this;
  }

  values(recordOrRecords: Record<string, unknown> | Record<string, unknown>[]): this {
    if (Array.isArray(recordOrRecords)) {
      this.records.push(...recordOrRecords);
    } else {
      this.records.push(recordOrRecords);
    }
    return this;
  }

  toSql(dialect: Dialect = "sqlite"): { sql: string; params: unknown[] } {
    if (!this.tableName) {
      throw new Error("InsertQueryBuilder requires a table name via .into(table)");
    }
    if (this.records.length === 0) {
      throw new Error("InsertQueryBuilder requires at least one record via .values(...)");
    }

    const columns = Object.keys(this.records[0]);
    if (columns.length === 0) {
      throw new Error("Record cannot be empty");
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    const rowPlaceholders: string[] = [];
    for (const record of this.records) {
      const placeholders: string[] = [];
      for (const col of columns) {
        placeholders.push(formatPlaceholder(paramIndex++, dialect));
        params.push(record[col]);
      }
      rowPlaceholders.push(`(${placeholders.join(", ")})`);
    }

    const colNames = columns.map(quoteIdentifier).join(", ");
    const sql = `INSERT INTO ${quoteIdentifier(this.tableName)} (${colNames}) VALUES ${rowPlaceholders.join(", ")}`;

    return { sql, params };
  }

  async execute(db: DatabasePort): Promise<number> {
    const { sql, params } = this.toSql(db.capabilities.dialect);
    return db.execute(sql, params);
  }
}

export class UpdateQueryBuilder<_T = Record<string, unknown>> {
  private tableName = "";
  private updateValues: Record<string, unknown> = {};
  private conditions: WhereCondition[] = [];

  table(table: string): this {
    this.tableName = table;
    return this;
  }

  set(values: Record<string, unknown>): this {
    this.updateValues = { ...this.updateValues, ...values };
    return this;
  }

  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.conditions.push({ column, operator, value, connector: "AND" });
    return this;
  }

  toSql(dialect: Dialect = "sqlite"): { sql: string; params: unknown[] } {
    if (!this.tableName) {
      throw new Error("UpdateQueryBuilder requires a table name via .table(table)");
    }
    const setKeys = Object.keys(this.updateValues);
    if (setKeys.length === 0) {
      throw new Error("UpdateQueryBuilder requires values to update via .set(...)");
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    const setParts = setKeys.map((col) => {
      const ph = formatPlaceholder(paramIndex++, dialect);
      params.push(this.updateValues[col]);
      return `${quoteIdentifier(col)} = ${ph}`;
    });

    let sql = `UPDATE ${quoteIdentifier(this.tableName)} SET ${setParts.join(", ")}`;

    if (this.conditions.length > 0) {
      const whereParts: string[] = [];
      for (let i = 0; i < this.conditions.length; i++) {
        const cond = this.conditions[i];
        const prefix = i === 0 ? "" : ` ${cond.connector} `;
        const colQuoted = quoteIdentifier(cond.column);

        if (cond.operator === "IS NULL" || cond.operator === "IS NOT NULL") {
          whereParts.push(`${prefix}${colQuoted} ${cond.operator}`);
        } else {
          const ph = formatPlaceholder(paramIndex++, dialect);
          params.push(cond.value);
          whereParts.push(`${prefix}${colQuoted} ${cond.operator} ${ph}`);
        }
      }
      sql += ` WHERE ${whereParts.join("")}`;
    }

    return { sql, params };
  }

  async execute(db: DatabasePort): Promise<number> {
    const { sql, params } = this.toSql(db.capabilities.dialect);
    return db.execute(sql, params);
  }
}

export class DeleteQueryBuilder<_T = Record<string, unknown>> {
  private tableName = "";
  private conditions: WhereCondition[] = [];

  from(table: string): this {
    this.tableName = table;
    return this;
  }

  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.conditions.push({ column, operator, value, connector: "AND" });
    return this;
  }

  toSql(dialect: Dialect = "sqlite"): { sql: string; params: unknown[] } {
    if (!this.tableName) {
      throw new Error("DeleteQueryBuilder requires a table name via .from(table)");
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    let sql = `DELETE FROM ${quoteIdentifier(this.tableName)}`;

    if (this.conditions.length > 0) {
      const whereParts: string[] = [];
      for (let i = 0; i < this.conditions.length; i++) {
        const cond = this.conditions[i];
        const prefix = i === 0 ? "" : ` ${cond.connector} `;
        const colQuoted = quoteIdentifier(cond.column);

        if (cond.operator === "IS NULL" || cond.operator === "IS NOT NULL") {
          whereParts.push(`${prefix}${colQuoted} ${cond.operator}`);
        } else {
          const ph = formatPlaceholder(paramIndex++, dialect);
          params.push(cond.value);
          whereParts.push(`${prefix}${colQuoted} ${cond.operator} ${ph}`);
        }
      }
      sql += ` WHERE ${whereParts.join("")}`;
    }

    return { sql, params };
  }

  async execute(db: DatabasePort): Promise<number> {
    const { sql, params } = this.toSql(db.capabilities.dialect);
    return db.execute(sql, params);
  }
}

export function createQueryBuilder() {
  return {
    select<T = Record<string, unknown>>(...cols: string[]) {
      return new SelectQueryBuilder<T>().select(...cols);
    },
    insert<T = Record<string, unknown>>() {
      return new InsertQueryBuilder<T>();
    },
    update<T = Record<string, unknown>>() {
      return new UpdateQueryBuilder<T>();
    },
    delete<T = Record<string, unknown>>() {
      return new DeleteQueryBuilder<T>();
    },
  };
}
