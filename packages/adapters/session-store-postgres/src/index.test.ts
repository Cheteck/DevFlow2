import { describe, it, expect, beforeEach } from "vitest";
import { PostgresSessionStoreAdapter } from "./index.js";
import type { DatabaseConnection } from "@mosaix/ports-database";

const createMockDbPort = () => {
  const sessions = new Map<string, Record<string, unknown>>();

  const query = async <T>(sql: string, params?: readonly unknown[]): Promise<T[]> => {
    if (sql.includes("INSERT INTO sessions")) {
      const [id, identityId, tenantId, applicationId, createdAt, expiresAt, attributes] = params ?? [];
      sessions.set(String(id), {
        id,
        identityId,
        tenantId,
        applicationId,
        createdAt,
        expiresAt,
        revokedAt: null,
        attributes: typeof attributes === "string" ? JSON.parse(attributes) : attributes,
      });
      return [] as T[];
    }

    if (sql.includes("SELECT") && sql.includes("WHERE id =")) {
      const id = String(params?.[0]);
      const found = sessions.get(id);
      return (found ? [found] : []) as T[];
    }

    if (sql.includes("UPDATE sessions")) {
      const revokedAt = String(params?.[0]);
      const id = String(params?.[1]);
      const found = sessions.get(id);
      if (found) {
        found.revokedAt = revokedAt;
      }
      return [] as T[];
    }

    if (sql.includes("WHERE identity_id =")) {
      const identityId = String(params?.[0]);
      const results = Array.from(sessions.values()).filter(
        (s) => s.identityId === identityId && (!s.revokedAt || s.revokedAt === null)
      );
      return results as T[];
    }

    return [] as T[];
  };

  const execute = async (sql: string, params?: readonly unknown[]): Promise<number> => {
    await query(sql, params);
    return 1;
  };

  const transaction = async <T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> => {
    return fn({ query, execute });
  };

  return { query, execute, transaction };
};

describe("PostgresSessionStoreAdapter", () => {
  let adapter: PostgresSessionStoreAdapter;

  beforeEach(() => {
    const db = createMockDbPort();
    adapter = new PostgresSessionStoreAdapter(db);
  });

  it("creates, retrieves, and revokes a session", async () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 3600000);

    const session = {
      id: "sess-100",
      identityId: "user-1",
      tenantId: "tenant-1",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      attributes: { role: "admin" },
    };

    await adapter.create(session);
    const retrieved = await adapter.get("sess-100");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("sess-100");
    expect(retrieved?.identityId).toBe("user-1");

    await adapter.revoke("sess-100");
    const revoked = await adapter.get("sess-100");
    expect(revoked?.revokedAt).toBeDefined();

    const active = await adapter.listActiveForIdentity("user-1");
    expect(active.length).toBe(0);
  });
});
