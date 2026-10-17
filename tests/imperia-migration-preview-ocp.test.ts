import { describe, it, expect } from "vitest";
import {
  MigrationGovernanceService,
  registerMigrationSqlPreview,
} from "../apps/imperia/src/domain/migration-governance.service.js";

describe("Imperia Migration SQL Preview OCP Extension", () => {
  it("allows registering custom SQL preview generators without modifying previewMigrationSQL method", () => {
    const service = new MigrationGovernanceService();

    // Register a custom preview handler for a custom migration ID
    registerMigrationSqlPreview(
      "app.custom.v1.001_analytics",
      (_id) => `CREATE TABLE custom_analytics (id VARCHAR(36) PRIMARY KEY);`
    );

    // Add custom migration item to internal/mocked list via registration check
    const customResult = service.previewMigrationSQL("app.custom.v1.001_analytics");

    expect(customResult).toBeDefined();
    expect(customResult.id).toBe("app.custom.v1.001_analytics");
    expect(customResult.sqlPreview).toContain("CREATE TABLE custom_analytics");
    expect(customResult.dryRunSuccess).toBe(true);
  });
});
