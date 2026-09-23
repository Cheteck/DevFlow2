import { Model } from "@mosaix/sdk";

export interface AuditLogAttributes {
  id?: string;
  actorId: string;
  action: string;
  resource: string;
  status: "success" | "failure";
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export class AuditLogModel extends Model {
  static override tableName = "imperia_audit_logs";

  actorId!: string;
  action!: string;
  resource!: string;
  status!: "success" | "failure";
  metadata?: Record<string, unknown>;
}
