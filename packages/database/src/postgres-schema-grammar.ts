/**
 * @mosaix/database — Postgres Schema Grammar & SchemaBuilder
 */

export class PostgresSchemaGrammar {
  compileCreateSchema(schemaName: string, ifNotExists: boolean = true): string {
    const clause = ifNotExists ? "IF NOT EXISTS " : "";
    return `CREATE SCHEMA ${clause}"${schemaName}";`;
  }

  compileDropSchema(schemaName: string, cascade: boolean = false): string {
    const cascadeClause = cascade ? " CASCADE" : "";
    return `DROP SCHEMA IF EXISTS "${schemaName}"${cascadeClause};`;
  }

  compileSetSearchPath(schemas: string[]): string {
    const formatted = schemas.map((s) => (s === "public" ? "public" : `"${s}"`)).join(", ");
    return `SET search_path TO ${formatted};`;
  }

  compileGrantSchema(schemaName: string, role: string, privileges: string[] = ["USAGE", "CREATE"]): string {
    return `GRANT ${privileges.join(", ")} ON SCHEMA "${schemaName}" TO "${role}";`;
  }

  compileTableInSchema(tableName: string, schemaName?: string): string {
    if (!schemaName || schemaName === "public") {
      return `"${tableName}"`;
    }
    return `"${schemaName}"."${tableName}"`;
  }

  compileMoveTableToSchema(tableName: string, targetSchema: string, currentSchema?: string): string {
    const source = currentSchema && currentSchema !== "public" ? `"${currentSchema}"."${tableName}"` : `"${tableName}"`;
    return `ALTER TABLE ${source} SET SCHEMA "${targetSchema}";`;
  }

  compileEnableRls(tableName: string, schemaName?: string): string {
    const fullTable = this.compileTableInSchema(tableName, schemaName);
    return `ALTER TABLE ${fullTable} ENABLE ROW LEVEL SECURITY;`;
  }

  compileForceRls(tableName: string, schemaName?: string): string {
    const fullTable = this.compileTableInSchema(tableName, schemaName);
    return `ALTER TABLE ${fullTable} FORCE ROW LEVEL SECURITY;`;
  }

  compileTenantPolicy(
    tableName: string,
    policyName: string,
    tenantColumn: string = "tenant_id",
    schemaName?: string,
    settingKey: string = "app.current_tenant_id"
  ): string {
    const fullTable = this.compileTableInSchema(tableName, schemaName);
    return `CREATE POLICY "${policyName}" ON ${fullTable} FOR ALL USING (${tenantColumn} = current_setting('${settingKey}', true));`;
  }
}

export class SchemaBuilder {
  private currentSchema?: string;
  private grammar = new PostgresSchemaGrammar();

  inSchema(schemaName: string): this {
    this.currentSchema = schemaName;
    return this;
  }

  getSchema(): string | undefined {
    return this.currentSchema;
  }

  compileCreateSchema(ifNotExists: boolean = true): string {
    if (!this.currentSchema) {
      throw new Error("No schema selected. Call .inSchema(name) first.");
    }
    return this.grammar.compileCreateSchema(this.currentSchema, ifNotExists);
  }

  compileTable(tableName: string): string {
    return this.grammar.compileTableInSchema(tableName, this.currentSchema);
  }

  compileMoveTable(tableName: string, targetSchema: string): string {
    return this.grammar.compileMoveTableToSchema(tableName, targetSchema, this.currentSchema);
  }

  compileEnableRls(tableName: string): string {
    return this.grammar.compileEnableRls(tableName, this.currentSchema);
  }

  compileTenantPolicy(tableName: string, policyName: string, tenantColumn: string = "tenant_id"): string {
    return this.grammar.compileTenantPolicy(tableName, policyName, tenantColumn, this.currentSchema);
  }
}
