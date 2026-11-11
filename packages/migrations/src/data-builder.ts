/**
 * @mosaix/migrations — Data builder (data migrations without raw SQL).
 *
 * A migration is not only a schema change: it may also move data
 * (backfill, seed, normalization). The engine provides a structured API for
 * that — the Laravel `DB::table()` equivalent — so that a migration never
 * has to carry a raw SQL command.
 *
 * The statements are recorded in the same ordered blueprint list as the
 * schema operations: the interleaving of DDL and DML is preserved exactly as
 * the migration declares it.
 */

import type { Condition, Expression, SelectStatement } from "./expressions.js";
import type { QualifiedTable } from "./schema-builder.js";
import { resolveTable } from "./schema-builder.js";

export type { Condition, Expression, SelectStatement };

/** Options of an insert statement. */
export interface InsertOptions {
  /** `ON CONFLICT DO NOTHING`. */
  readonly onConflictIgnore?: boolean;
}

/**
 * Records the data statements of a migration.
 *
 * The builder is bound to the schema builder: both write into the same
 * ordered list of statements.
 */
export class DataBuilder {
  constructor(private readonly target: { blueprints: unknown[] }) {}

  /** Inserts a row. */
  insert(
    table: string | QualifiedTable,
    row: Readonly<Record<string, Expression | unknown>>,
    options?: InsertOptions,
  ): void {
    const reference = resolveTable(table);
    this.target.blueprints.push({
      type: "insertRow",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      row,
      ...(options?.onConflictIgnore !== undefined
        ? { onConflictIgnore: options.onConflictIgnore }
        : {}),
    });
  }

  /** Inserts the rows produced by a SELECT statement. */
  insertSelect(
    table: string | QualifiedTable,
    columns: readonly string[],
    select: SelectStatement,
    options?: InsertOptions,
  ): void {
    const reference = resolveTable(table);
    this.target.blueprints.push({
      type: "insertSelect",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      columns,
      select,
      ...(options?.onConflictIgnore !== undefined
        ? { onConflictIgnore: options.onConflictIgnore }
        : {}),
    });
  }

  /** Updates the rows matching the conditions. */
  update(
    table: string | QualifiedTable,
    assignments: Readonly<Record<string, Expression | unknown>>,
    where: readonly Condition[],
  ): void {
    const reference = resolveTable(table);
    this.target.blueprints.push({
      type: "updateRow",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      assignments,
      where,
    });
  }

  /** Deletes the rows matching the conditions. */
  delete(table: string | QualifiedTable, where: readonly Condition[]): void {
    const reference = resolveTable(table);
    this.target.blueprints.push({
      type: "deleteRow",
      table: reference.name,
      ...(reference.schema !== undefined ? { schema: reference.schema } : {}),
      where,
    });
  }
}
