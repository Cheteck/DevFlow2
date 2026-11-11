/**
 * @mosaix/migrations — Rendering of the structured expressions.
 *
 * The grammars share the rendering of expressions, conditions and subqueries:
 * only the placeholder differs (`?` on both dialects, the PostgreSQL
 * adapter rewrites them to `$n`).
 */

import type { Condition, Expression, SelectStatement } from "./expressions.js";

/** Collects the parameters of a rendered expression. */
export interface RenderContext {
  readonly params: unknown[];
}

/** Renders a column name, qualified when needed (`"v"."id"`). */
export function renderColumnName(name: string): string {
  return name
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

/** Renders an expression, collecting its parameters. */
export function renderExpression(
  expression: Expression,
  context: RenderContext,
): string {
  switch (expression.kind) {
    case "literal": {
      const v = expression.value;
      if (v === null || v === undefined) return "NULL";
      // The literal `1` of an existence probe (`SELECT 1 FROM …`) is a
      // constant, not a bound parameter.
      if (v === 1 && expression.constant === true) return "1";
      context.params.push(v);
      return "?";
    }
    case "column":
      return renderColumnName(expression.name);
    case "jsonPath":
      // The parentheses are redundant in PostgreSQL: `"data"->>'key'` is the
      // same expression as `("data"->>'key')`.
      return `"${expression.column}"->>'${expression.key}'`;
    case "cast":
      return `${renderExpression(expression.target, context)}::${expression.type}`;
    case "nullIf":
      return `NULLIF(${renderExpression(expression.target, context)}, ${renderExpression(expression.fallback, context)})`;
    case "matches": {
      return `${renderExpression(expression.target, context)} ~ ${renderExpression(expression.pattern, context)}`;
    }
    case "inList": {
      const values = expression.values.map((v) => renderExpression(v, context));
      return `${renderExpression(expression.target, context)} IN (${values.join(", ")})`;
    }
    case "subquery":
      return renderSelect(expression.select, context);
    case "function": {
      const args = expression.args.map((arg) =>
        arg.kind === "function" && arg.name === "*"
          ? "*"
          : renderExpression(arg, context),
      );
      return `${expression.name}(${args.join(", ")})`;
    }
  }
}

/** Renders a condition, collecting its parameters. */
export function renderCondition(
  condition: Condition,
  context: RenderContext,
): string {
  switch (condition.kind) {
    case "equals":
      return `${renderColumnName(condition.column)} = ${renderExpression(condition.value, context)}`;
    case "isNull":
      return `${renderColumnName(condition.column)} IS NULL`;
    case "isNotNull":
      return `${renderColumnName(condition.column)} IS NOT NULL`;
    case "compare":
      return `${renderColumnName(condition.column)} ${condition.operator} ${renderExpression(condition.value, context)}`;
    case "matchesPattern": {
      return `${renderExpression(condition.target, context)} ~ ${renderExpression(condition.pattern, context)}`;
    }
    case "in": {
      const values = condition.values.map((v) => renderExpression(v, context));
      return `${renderColumnName(condition.column)} IN (${values.join(", ")})`;
    }
    case "inSubquery":
      return `${renderColumnName(condition.column)} IN ${renderSelect(condition.select, context)}`;
    case "notExists":
      return `NOT EXISTS ${renderSelect(condition.select, context)}`;
  }
}

/** Renders a list of conditions joined by AND. */
export function renderConditions(
  conditions: readonly Condition[],
  context: RenderContext,
): string {
  return conditions
    .map((condition) => renderCondition(condition, context))
    .join(" AND ");
}

/**
 * Renders the body of a SELECT statement (`SELECT …`), without the
 * enclosing parentheses.
 */
export function renderSelectBody(
  statement: SelectStatement,
  context: RenderContext,
): string {
  const columns = statement.columns
    .map((projection) => {
      if (typeof projection === "string") {
        return renderColumnName(projection);
      }
      if ("kind" in projection) {
        // A bare expression.
        return renderExpression(projection, context);
      }
      const rendered = renderExpression(projection.expression, context);
      return projection.alias !== undefined
        ? `${rendered} AS ${renderColumnName(projection.alias)}`
        : rendered;
    })
    .join(", ");
  const from =
    statement.from !== undefined
      ? ` FROM "${statement.from.schema ?? "public"}"."${statement.from.name}"${
          statement.from.alias !== undefined
            ? ` AS ${statement.from.alias}`
            : ""
        }`
      : "";
  const where =
    statement.where !== undefined && statement.where.length > 0
      ? ` WHERE ${renderConditions(statement.where, context)}`
      : "";
  return `SELECT ${columns}${from}${where}`;
}

/** Renders a SELECT statement (subquery). */
export function renderSelect(
  statement: SelectStatement,
  context: RenderContext,
): string {
  return `(${renderSelectBody(statement, context)})`;
}
