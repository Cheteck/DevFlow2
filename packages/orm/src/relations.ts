/**
 * @mosaix/orm — ORM Relations
 */

export type RelationType = "hasMany" | "belongsTo" | "manyToMany";

export interface RelationMetadata {
  type: RelationType;
  targetModel: new () => unknown;
  foreignKey: string;
  primaryKey?: string;
  pivotTable?: string;
}

export function hasMany(targetModel: new () => unknown, foreignKey: string): RelationMetadata {
  return { type: "hasMany", targetModel, foreignKey };
}

export function belongsTo(targetModel: new () => unknown, foreignKey: string): RelationMetadata {
  return { type: "belongsTo", targetModel, foreignKey };
}

export function manyToMany(targetModel: new () => unknown, pivotTable: string, foreignKey: string): RelationMetadata {
  return { type: "manyToMany", targetModel, foreignKey, pivotTable };
}
