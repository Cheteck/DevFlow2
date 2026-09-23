/**
 * @mosaix/orm — QueryBuilder
 *
 * Fluent AST-based SQL query builder supporting SQLite and PostgreSQL dialects with parameter binding & identifier escaping.
 */

export type SQLDialect = "sqlite" | "postgres";

export type WhereOperator = "=" | "!=" | "<" | "<=" | ">" | ">=" | "LIKE" | "ILIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL";

export interface WhereClause {
  column: string;
  operator: WhereOperator;
  value?: unknown;
  boolean?: "AND" | "OR";
}

export interface JoinClause {
  type: "INNER" | "LEFT" | "RIGHT";
  table: string;
  first: string;
  operator: string;
  second: string;
}

export interface OrderByClause {
  column: string;
  direction: "ASC" | "DESC";
}

export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

export class QueryBuilder<_TRecord extends Record<string, unknown> = Record<string, unknown>> {
  private dialect: SQLDialect;
  private tableName = "";
  private selectColumns: string[] = ["*"];
  private whereClauses: WhereClause[] = [];
  private joinClauses: JoinClause[] = [];
  private orderByClauses: OrderByClause[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private queryType: "SELECT" | "INSERT" | "UPDATE" | "DELETE" = "SELECT";
  private insertData?: Record<string, unknown> | Array<Record<string, unknown>>;
  private updateData?: Record<string, unknown>;

  constructor(dialect: SQLDialect = "postgres") {
    this.dialect = dialect;
  }

  static table<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    dialect: SQLDialect = "postgres",
  ): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(dialect);
    qb.tableName = table;
    return qb;
  }

  from(table: string): this {
    this.tableName = table;
    return this;
  }

  select(...columns: string[]): this {
    if (columns.length > 0) {
      this.selectColumns = columns;
    }
    return this;
  }

  where(column: string, operatorOrValue: WhereOperator | unknown, value?: unknown): this {
    let operator: WhereOperator = "=";
    let val = operatorOrValue;

    if (value !== undefined) {
      operator = operatorOrValue as WhereOperator;
      val = value;
    }

    this.whereClauses.push({
      column,
      operator,
      value: val,
      boolean: "AND",
    });
    return this;
  }

  orWhere(column: string, operatorOrValue: WhereOperator | unknown, value?: unknown): this {
    let operator: WhereOperator = "=";
    let val = operatorOrValue;

    if (value !== undefined) {
      operator = operatorOrValue as WhereOperator;
      val = value;
    }

    this.whereClauses.push({
      column,
      operator,
      value: val,
      boolean: "OR",
    });
    return this;
  }

  whereIn(column: string, values: unknown[]): this {
    this.whereClauses.push({
      column,
      operator: "IN",
      value: values,
      boolean: "AND",
    });
    return this;
  }

  whereNull(column: string): this {
    this.whereClauses.push({
      column,
      operator: "IS NULL",
      boolean: "AND",
    });
    return this;
  }

  whereNotNull(column: string): this {
    this.whereClauses.push({
      column,
      operator: "IS NOT NULL",
      boolean: "AND",
    });
    return this;
  }

  join(table: string, first: string, operator: string, second: string, type: "INNER" | "LEFT" | "RIGHT" = "INNER"): this {
    this.joinClauses.push({ type, table, first, operator, second });
    return this;
  }

  leftJoin(table: string, first: string, operator: string, second: string): this {
    return this.join(table, first, operator, second, "LEFT");
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClauses.push({ column, direction });
    return this;
  }

  limit(limit: number): this {
    this.limitValue = Math.max(0, limit);
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = Math.max(0, offset);
    return this;
  }

  insert(data: Record<string, unknown> | Array<Record<string, unknown>>): this {
    this.queryType = "INSERT";
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.queryType = "UPDATE";
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.queryType = "DELETE";
    return this;
  }

  toSQL(): CompiledQuery {
    if (!this.tableName) {
      throw new Error("Table name is required for query execution.");
    }

    switch (this.queryType) {
      case "INSERT":
        return this.compileInsert();
      case "UPDATE":
        return this.compileUpdate();
      case "DELETE":
        return this.compileDelete();
      case "SELECT":
      default:
        return this.compileSelect();
    }
  }

  private compileWhereClauses(params: unknown[]): string {
    if (this.whereClauses.length === 0) return "";

    const whereParts: string[] = [];
    this.whereClauses.forEach((clause, index) => {
      const prefix = index === 0 ? "" : ` ${clause.boolean} `;
      if (clause.operator === "IS NULL" || clause.operator === "IS NOT NULL") {
        whereParts.push(`${prefix}${this.quoteIdentifier(clause.column)} ${clause.operator}`);
      } else if (clause.operator === "IN" || clause.operator === "NOT IN") {
        const list = Array.isArray(clause.value) ? clause.value : [clause.value];
        const placeholders = list.map((val) => {
          params.push(val);
          return this.getPlaceholder(params.length);
        });
        whereParts.push(`${prefix}${this.quoteIdentifier(clause.column)} ${clause.operator} (${placeholders.join(", ")})`);
      } else {
        params.push(clause.value);
        whereParts.push(`${prefix}${this.quoteIdentifier(clause.column)} ${clause.operator} ${this.getPlaceholder(params.length)}`);
      }
    });

    return ` WHERE ${whereParts.join("")}`;
  }

  private compileSelect(): CompiledQuery {
    const params: unknown[] = [];
    const cols = this.selectColumns.map((c) => (c === "*" ? "*" : this.quoteIdentifier(c))).join(", ");
    let sql = `SELECT ${cols} FROM ${this.quoteIdentifier(this.tableName)}`;

    if (this.joinClauses.length > 0) {
      const joins = this.joinClauses
        .map(
          (j) =>
            `${j.type} JOIN ${this.quoteIdentifier(j.table)} ON ${this.quoteIdentifier(j.first)} ${j.operator} ${this.quoteIdentifier(j.second)}`,
        )
        .join(" ");
      sql += ` ${joins}`;
    }

    sql += this.compileWhereClauses(params);

    if (this.orderByClauses.length > 0) {
      const order = this.orderByClauses
        .map((o) => `${this.quoteIdentifier(o.column)} ${o.direction}`)
        .join(", ");
      sql += ` ORDER BY ${order}`;
    }

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  private compileInsert(): CompiledQuery {
    const params: unknown[] = [];
    const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData!];
    if (records.length === 0) {
      throw new Error("No data provided for INSERT.");
    }

    const keys = Object.keys(records[0] as Record<string, unknown>);
    const cols = keys.map((k) => this.quoteIdentifier(k)).join(", ");

    const valueRows: string[] = [];
    for (const record of records) {
      const rowPlaceholders: string[] = [];
      for (const key of keys) {
        params.push(record[key]);
        rowPlaceholders.push(this.getPlaceholder(params.length));
      }
      valueRows.push(`(${rowPlaceholders.join(", ")})`);
    }

    let sql = `INSERT INTO ${this.quoteIdentifier(this.tableName)} (${cols}) VALUES ${valueRows.join(", ")}`;
    if (this.dialect === "postgres") {
      sql += " RETURNING *";
    }

    return { sql, params };
  }

  private compileUpdate(): CompiledQuery {
    const params: unknown[] = [];
    const updates: string[] = [];

    for (const [key, value] of Object.entries(this.updateData ?? {})) {
      params.push(value);
      updates.push(`${this.quoteIdentifier(key)} = ${this.getPlaceholder(params.length)}`);
    }

    let sql = `UPDATE ${this.quoteIdentifier(this.tableName)} SET ${updates.join(", ")}`;
    sql += this.compileWhereClauses(params);

    return { sql, params };
  }

  private compileDelete(): CompiledQuery {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.quoteIdentifier(this.tableName)}`;
    sql += this.compileWhereClauses(params);

    return { sql, params };
  }

  private getPlaceholder(index: number): string {
    return this.dialect === "postgres" ? `$${index}` : "?";
  }

  private quoteIdentifier(identifier: string): string {
    if (identifier === "*") return "*";
    if (identifier.includes(".")) {
      return identifier
        .split(".")
        .map((part) => this.sanitizePart(part))
        .join(".");
    }
    return this.sanitizePart(identifier);
  }

  private sanitizePart(part: string): string {
    // Sanitize quotes to prevent identifier injection attacks
    const clean = part.replace(/["`]/g, "");
    return this.dialect === "postgres" ? `"${clean}"` : `\`${clean}\``;
  }
}
