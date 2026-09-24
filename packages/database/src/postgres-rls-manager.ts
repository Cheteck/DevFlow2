import type { DatabasePort } from "@mosaix/ports-database";
import { PostgresSchemaGrammar } from "./postgres-schema-grammar.js";

export class PostgresRlsManager {
  private grammar = new PostgresSchemaGrammar();

  async enableRls(db: DatabasePort, schema: string, table: string, force: boolean = true): Promise<void> {
    await db.execute(this.grammar.compileEnableRls(table, schema));
    if (force) {
      await db.execute(this.grammar.compileForceRls(table, schema));
    }
  }

  async applyTenantIsolationPolicy(
    db: DatabasePort,
    schema: string,
    table: string,
    policyName: string = "tenant_isolation_policy",
    tenantColumn: string = "tenant_id",
    settingKey: string = "app.current_tenant_id"
  ): Promise<void> {
    const fullTable = this.grammar.compileTableInSchema(table, schema);
    await db.execute(`DROP POLICY IF EXISTS "${policyName}" ON ${fullTable};`);
    await db.execute(this.grammar.compileTenantPolicy(table, policyName, tenantColumn, schema, settingKey));
  }

  async setSessionTenant(db: DatabasePort, tenantId: string, isLocal: boolean = true): Promise<void> {
    const prefix = isLocal ? "SET LOCAL" : "SET";
    // Sanitize tenantId to prevent injection
    const sanitized = tenantId.replace(/'/g, "''");
    await db.execute(`${prefix} app.current_tenant_id = '${sanitized}';`);
  }

  async resetSessionTenant(db: DatabasePort): Promise<void> {
    await db.execute(`RESET app.current_tenant_id;`);
  }
}
