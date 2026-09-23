/**
 * @apps/portfolio — Vendable & Variant ORM Models with Relations
 */

import { Model, hasMany, type RelationMetadata } from "@mosaix/sdk";

export class VariantModel extends Model {
  static override tableName = "vendable_variants";

  vendableId!: string;
  sku!: string;
  name!: string;
}

export class VendableModel extends Model {
  static override tableName = "vendables";

  title!: string;
  type!: "product" | "service" | "digital" | "experience";
  status!: "Draft" | "In Review" | "Validated" | "Published" | "Archived";

  static variantsRelation(): RelationMetadata {
    return hasMany(VariantModel, "vendableId");
  }
}
