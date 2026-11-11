/**
 * @mosaix/migrations — Structured SQL expressions.
 *
 * A data migration must be able to read and write values that are not
 * plain literals: a column, a JSON document key, a cast, a nullable
 * fallback, a regular expression match, a list, a subquery.
 *
 * The engine models them as a closed set of expressions and conditions —
 * never as free-form SQL text. The grammars render them for the target
 * dialect; the values travel as statement parameters.
 */

/** A value expression. */
export type Expression =
  | LiteralExpression
  | ColumnExpression
  | JsonPathExpression
  | CastExpression
  | NullIfExpression
  | MatchesExpression
  | InListExpression
  | SubqueryExpression
  | FunctionExpression;

/** A constant value (travels as a statement parameter). */
export interface LiteralExpression {
  readonly kind: "literal";
  readonly value: unknown;
  /**
   * The literal is a constant of the statement (`SELECT 1`): it is rendered
   * inline instead of being bound as a parameter.
   */
  readonly constant?: boolean;
}

/** A column reference (`"id"`). */
export interface ColumnExpression {
  readonly kind: "column";
  readonly name: string;
}

/** A JSON document key (`("data"->>'key')`, PostgreSQL). */
export interface JsonPathExpression {
  readonly kind: "jsonPath";
  readonly column: string;
  readonly key: string;
}

/** A cast (`(("data"->>'qty')::int)`). */
export interface CastExpression {
  readonly kind: "cast";
  readonly target: Expression;
  readonly type: string;
}

/** A nullable fallback (`NULLIF(a, b)`). */
export interface NullIfExpression {
  readonly kind: "nullIf";
  readonly target: Expression;
  readonly fallback: Expression;
}

/** A regular expression match (`target ~ pattern`). */
export interface MatchesExpression {
  readonly kind: "matches";
  readonly target: Expression;
  readonly pattern: Expression;
}

/** A list membership (`target IN (a, b)`). */
export interface InListExpression {
  readonly kind: "inList";
  readonly target: Expression;
  readonly values: readonly Expression[];
}

/** A subquery (`(SELECT ...)`). */
export interface SubqueryExpression {
  readonly kind: "subquery";
  readonly select: SelectStatement;
}

/** A function call (`now()`, `lower("name")`). */
export interface FunctionExpression {
  readonly kind: "function";
  readonly name: string;
  readonly args: readonly Expression[];
}

/** A table of a SELECT statement. */
export interface SelectTable {
  readonly schema?: string;
  readonly name: string;
  readonly alias?: string;
}

/**
 * A projected column: a plain column name or an expression (a literal, a
 * column, a subquery, …), with an optional alias.
 */
export type Projection = string | Expression | ProjectedExpression;

/** An expression projected by a SELECT statement, with an optional alias. */
export interface ProjectedExpression {
  readonly expression: Expression;
  readonly alias?: string;
}

/** A SELECT statement (subquery). */
export interface SelectStatement {
  readonly columns: readonly Projection[];
  /** Omitted for a projection without source (`SELECT 1`). */
  readonly from?: SelectTable;
  readonly where?: readonly Condition[];
}

// ─── Conditions ────────────────────────────────────────────────────────

/** A row condition. */
export type Condition =
  | EqualsCondition
  | IsNullCondition
  | IsNotNullCondition
  | CompareCondition
  | MatchesCondition
  | InCondition
  | InSubqueryCondition
  | NotExistsCondition;

export interface EqualsCondition {
  readonly kind: "equals";
  readonly column: string;
  readonly value: Expression;
}

export interface IsNullCondition {
  readonly kind: "isNull";
  readonly column: string;
}

export interface IsNotNullCondition {
  readonly kind: "isNotNull";
  readonly column: string;
}

export interface CompareCondition {
  readonly kind: "compare";
  readonly operator: ">" | ">=" | "<" | "<=" | "<>";
  readonly column: string;
  readonly value: Expression;
}

/** A regular expression match on an expression (`("data"->>'k') ~ 'p'`). */
export interface MatchesCondition {
  readonly kind: "matchesPattern";
  readonly target: Expression;
  readonly pattern: Expression;
}

export interface InCondition {
  readonly kind: "in";
  readonly column: string;
  readonly values: readonly Expression[];
}

/** A subquery membership (`column IN (SELECT ...)`). */
export interface InSubqueryCondition {
  readonly kind: "inSubquery";
  readonly column: string;
  readonly select: SelectStatement;
}

export interface NotExistsCondition {
  readonly kind: "notExists";
  readonly select: SelectStatement;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** A constant value. */
export function value(v: unknown): LiteralExpression {
  return { kind: "literal", value: v };
}

/**
 * A constant of the statement, rendered inline (`SELECT 1`).
 *
 * The existence probes (`NOT EXISTS (SELECT 1 FROM …)`) use it: the `1` is
 * a constant of the query, not a data value.
 */
export function constant(v: unknown): LiteralExpression {
  return { kind: "literal", value: v, constant: true };
}

/** Narrows an unknown value to an expression (an already-built one is kept). */
export function isExpression(raw: unknown): raw is Expression {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "kind" in raw &&
    typeof (raw as { kind: unknown }).kind === "string"
  );
}

/** A column reference. */
export function column(name: string): ColumnExpression {
  return { kind: "column", name };
}

/** A JSON document key (`("column"->>'key')`). */
export function jsonPath(columnName: string, key: string): JsonPathExpression {
  return { kind: "jsonPath", column: columnName, key };
}

/** A cast. */
export function cast(target: Expression, type: string): CastExpression {
  return { kind: "cast", target, type };
}

/** A nullable fallback (`NULLIF(target, fallback)`). */
export function nullIf(
  target: Expression,
  fallback: Expression,
): NullIfExpression {
  return { kind: "nullIf", target, fallback };
}

/** A regular expression match. */
export function matches(
  target: Expression,
  pattern: Expression,
): MatchesExpression {
  return { kind: "matches", target, pattern };
}

/** A list membership. */
export function inList(
  target: Expression,
  values: readonly Expression[],
): InListExpression {
  return { kind: "inList", target, values };
}

/** A subquery. */
export function subquery(select: SelectStatement): SubqueryExpression {
  return { kind: "subquery", select };
}

/** A function call (`now()`, `lower("name")`). */
export function func(
  name: string,
  ...args: readonly Expression[]
): FunctionExpression {
  return { kind: "function", name, args };
}

/** `column = value`. */
export function equals(columnName: string, v: unknown): EqualsCondition {
  return {
    kind: "equals",
    column: columnName,
    value: isExpression(v) ? v : value(v),
  };
}

/** `column IS NULL`. */
export function isNull(columnName: string): IsNullCondition {
  return { kind: "isNull", column: columnName };
}

/** `column IS NOT NULL`. */
export function isNotNull(columnName: string): IsNotNullCondition {
  return { kind: "isNotNull", column: columnName };
}

/** `column <op> value`. */
export function compare(
  operator: CompareCondition["operator"],
  columnName: string,
  v: unknown,
): CompareCondition {
  return { kind: "compare", operator, column: columnName, value: value(v) };
}

/** `target ~ pattern` (a row condition). */
export function matchesPattern(
  target: Expression,
  pattern: Expression,
): MatchesCondition {
  return { kind: "matchesPattern", target, pattern };
}

/** `COUNT(*)`. */
export function count(): FunctionExpression {
  return {
    kind: "function",
    name: "COUNT",
    args: [{ kind: "function", name: "*", args: [] }],
  };
}

/** `column IN (...)`. */
export function inValues(
  columnName: string,
  values: readonly unknown[],
): InCondition {
  return {
    kind: "in",
    column: columnName,
    values: values.map((v) => (isExpression(v) ? v : value(v))),
  };
}

/** `column IN (SELECT ...)`. */
export function inSubquery(
  columnName: string,
  select: SelectStatement,
): InSubqueryCondition {
  return { kind: "inSubquery", column: columnName, select };
}

/** `NOT EXISTS (SELECT ...)`. */
export function notExists(select: SelectStatement): NotExistsCondition {
  return { kind: "notExists", select };
}

/** The configuration of a SELECT statement. */
export interface QueryConfig {
  readonly columns: readonly Projection[];
  /** Omitted for a projection without source (`SELECT 1`). */
  readonly from?: SelectTable;
  readonly where?: readonly Condition[];
}

/** Builds a SELECT statement (subquery). */
export function select(config: QueryConfig): SelectStatement {
  return {
    columns: config.columns,
    ...(config.from !== undefined ? { from: config.from } : {}),
    ...(config.where !== undefined ? { where: config.where } : {}),
  };
}
