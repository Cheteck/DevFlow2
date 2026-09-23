/**
 * @mosaix/orm — Model & Repository Primitive
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { QueryBuilder, type SQLDialect } from "./query-builder";

export abstract class Model {
  id!: string | number;
  createdAt?: Date;
  updatedAt?: Date;

  static tableName: string;
  static primaryKey = "id";

  static hydrate<T extends Model>(data: Record<string, unknown>): T {
    const instance = Object.create(this.prototype) as T;
    Object.assign(instance, data);
    return instance;
  }
}

export type ModelConstructor<T extends Model = Model> = (new () => T) & typeof Model;

export class Repository<T extends Model> {
  protected db: DatabasePort;
  protected modelCtor: ModelConstructor<T>;
  protected tableName: string;
  protected primaryKey: string;
  protected dialect: SQLDialect;

  constructor(
    db: DatabasePort,
    modelCtor: new () => T,
    tableName?: string,
    primaryKey = "id",
    dialect: SQLDialect = "postgres",
  ) {
    this.db = db;
    this.modelCtor = modelCtor as ModelConstructor<T>;
    this.tableName = tableName ?? this.modelCtor.tableName;
    this.primaryKey = primaryKey ?? this.modelCtor.primaryKey;
    this.dialect = dialect;

    if (!this.tableName) {
      throw new Error(`Repository requires a tableName or Model with static tableName property.`);
    }
  }

  query(): QueryBuilder<Record<string, unknown>> {
    return QueryBuilder.table(this.tableName, this.dialect);
  }

  async findById(id: string | number): Promise<T | null> {
    const qb = this.query().where(this.primaryKey, "=", id).limit(1);
    const { sql, params } = qb.toSQL();
    const rows = await this.db.query<Record<string, unknown>>(sql, params);
    if (!rows || rows.length === 0) return null;
    return this.modelCtor.hydrate<T>(rows[0]);
  }

  async findAll(): Promise<T[]> {
    const qb = this.query();
    const { sql, params } = qb.toSQL();
    const rows = await this.db.query<Record<string, unknown>>(sql, params);
    return (rows ?? []).map((row) => this.modelCtor.hydrate<T>(row));
  }

  async findWhere(where: Record<string, unknown>): Promise<T[]> {
    const qb = this.query();
    for (const [key, value] of Object.entries(where)) {
      qb.where(key, "=", value);
    }
    const { sql, params } = qb.toSQL();
    const rows = await this.db.query<Record<string, unknown>>(sql, params);
    return (rows ?? []).map((row) => this.modelCtor.hydrate<T>(row));
  }

  async create(data: Partial<T> | Record<string, unknown>): Promise<T> {
    const qb = this.query().insert(data as Record<string, unknown>);
    const { sql, params } = qb.toSQL();
    const result = await this.db.query<Record<string, unknown>>(sql, params);
    if (result && result.length > 0) {
      return this.modelCtor.hydrate<T>(result[0]);
    }
    return this.modelCtor.hydrate<T>(data as Record<string, unknown>);
  }

  async update(id: string | number, data: Partial<T> | Record<string, unknown>): Promise<boolean> {
    const qb = this.query().where(this.primaryKey, "=", id).update(data as Record<string, unknown>);
    const { sql, params } = qb.toSQL();
    const result = await this.db.execute(sql, params);
    return (result ?? 0) > 0;
  }

  async delete(id: string | number): Promise<boolean> {
    const qb = this.query().where(this.primaryKey, "=", id).delete();
    const { sql, params } = qb.toSQL();
    const result = await this.db.execute(sql, params);
    return (result ?? 0) > 0;
  }
}
