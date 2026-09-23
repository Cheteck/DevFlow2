/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @apps/commerce — Order Model with Traits & ORM
 */

import { Model, applyTraits, SoftDeleteTrait, TimestampableTrait } from "@mosaix/sdk";

export class OrderModel extends Model {
  static override tableName = "orders";

  userId!: string;
  vendableId!: string;
  status!: "Pending" | "Paid" | "Shipped" | "Cancelled";
}

export interface OrderModel extends TimestampableTrait, SoftDeleteTrait {}
applyTraits(OrderModel, [TimestampableTrait, SoftDeleteTrait]);
