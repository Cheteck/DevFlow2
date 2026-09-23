import { compareMigrationIds } from "@mosaix/migrations";

export interface DatabaseMigrationStatus {
  id: string;
  applicationId: string;
  version: string;
  name: string;
  applied: boolean;
  appliedAt?: Date;
  dependencies: string[];
}

export class MigrationGovernanceService {
  private migrations: DatabaseMigrationStatus[] = [
    {
      id: "framework.core.v1.001_bootstrap",
      applicationId: "core",
      version: "1.0.0",
      name: "Core Schema Bootstrap",
      applied: true,
      appliedAt: new Date("2026-08-01"),
      dependencies: [],
    },
    {
      id: "app.identity.v1.001_users",
      applicationId: "identity",
      version: "1.0.0",
      name: "Create Users & Credentials Table",
      applied: true,
      appliedAt: new Date("2026-08-02"),
      dependencies: ["framework.core.v1.001_bootstrap"],
    },
    {
      id: "app.portfolio.v1.001_vendables",
      applicationId: "portfolio",
      version: "1.0.0",
      name: "Create Vendables & Variants Table",
      applied: true,
      appliedAt: new Date("2026-08-05"),
      dependencies: ["framework.core.v1.001_bootstrap"],
    },
    {
      id: "app.imperia.v1.001_audit_logs",
      applicationId: "imperia",
      version: "1.0.0",
      name: "Create Imperia Audit Logs Table",
      applied: false,
      dependencies: ["framework.core.v1.001_bootstrap"],
    },
  ];

  listMigrations(): DatabaseMigrationStatus[] {
    return [...this.migrations].sort((a, b) => compareMigrationIds(a.id, b.id));
  }

  previewMigrationSQL(id: string): { id: string; sqlPreview: string; dryRunSuccess: boolean } {
    const migration = this.migrations.find((m) => m.id === id);
    if (!migration) {
      throw new Error(`Migration [${id}] non trouvée.`);
    }

    let sqlPreview: string;
    switch (id) {
      case 'framework.core.v1.001_bootstrap':
        sqlPreview = `CREATE TABLE IF NOT EXISTS mosaix_system_bootstrap (\n  id VARCHAR(36) PRIMARY KEY,\n  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`;
        break;
      case 'app.identity.v1.001_users':
        sqlPreview = `CREATE TABLE IF NOT EXISTS identity_users (\n  id VARCHAR(36) PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  password_hash VARCHAR(255) NOT NULL\n);`;
        break;
      case 'app.portfolio.v1.001_vendables':
        sqlPreview = `CREATE TABLE IF NOT EXISTS portfolio_vendables (\n  id VARCHAR(36) PRIMARY KEY,\n  reference VARCHAR(64) UNIQUE NOT NULL,\n  type VARCHAR(32) NOT NULL\n);`;
        break;
      case 'app.imperia.v1.001_audit_logs':
      default:
        sqlPreview = `CREATE TABLE IF NOT EXISTS imperia_audit_logs (\n  id VARCHAR(36) PRIMARY KEY,\n  actor_id VARCHAR(64) NOT NULL,\n  action VARCHAR(64) NOT NULL,\n  resource VARCHAR(128) NOT NULL,\n  status VARCHAR(16) NOT NULL,\n  metadata JSON,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`;
        break;
    }

    return {
      id,
      sqlPreview,
      dryRunSuccess: true,
    };
  }
}
