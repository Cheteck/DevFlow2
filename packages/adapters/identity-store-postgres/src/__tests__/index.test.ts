import { describe, expect, it } from "vitest";
import { PostgresIdentityStoreAdapter } from "../index.ts";
import type { DatabaseConnection } from "@mosaix/ports-database";

const createMockDbPort = () => {
  const data = new Map<string, Record<string, unknown>>();

  const query = async <T>(sql: string, params?: readonly unknown[]): Promise<T[]> => {
    if (sql.includes("SELECT") && sql.includes("identities")) {
      const param = params?.[0];
      const match = Array.from(data.entries()).find(
        ([, value]) => value.id === param || value.email === param,
      );
      return (match ? [match[1]] : []) as T[];
    }

    if (sql.includes("SELECT") && sql.includes("external_identities")) {
      const identityId = params?.[0];
      const results = [];
      for (const [, value] of data.entries()) {
        if (value.identityId === identityId) {
          results.push(value);
        }
      }
      return results as T[];
    }

    await execute(sql, params);
    return [] as T[];
  };

  const execute = async (sql: string, params?: readonly unknown[]): Promise<number> => {
    if (sql.includes("INSERT INTO identities")) {
      const [id, tenantId, email, displayName, status, createdAt, updatedAt, attributes] = params ?? [];
      data.set(String(id), {
        id,
        tenantId,
        email,
        displayName,
        status,
        createdAt,
        updatedAt,
        attributes: JSON.parse(String(attributes)),
      });
      return 1;
    }

    if (sql.includes("UPDATE identities")) {
      const [idObj, tenantId, email, displayName, status, updatedAt, attributes] = params ?? [];
      const id = String(idObj);
      if (data.has(id)) {
        const existing = data.get(id);
        data.set(id, {
          ...existing,
          tenantId,
          email: email ?? existing?.email,
          displayName: displayName ?? existing?.displayName,
          status,
          updatedAt,
          attributes: JSON.parse(String(attributes)),
        });
        return 1;
      }
      return 0;
    }

    if (sql.includes("INSERT INTO external_identities")) {
      const [identityId, provider, externalId, linkedAt, attributes] = params ?? [];
      const key = `${String(identityId)}:${String(provider)}:${String(externalId)}`;
      data.set(key, {
        identityId,
        provider,
        externalId,
        linkedAt,
        attributes: JSON.parse(String(attributes)),
      });
      return 1;
    }

    if (sql.includes("DELETE FROM external_identities")) {
      const [identityId, provider, externalId] = params ?? [];
      let deleted = 0;
      for (const [key] of data.entries()) {
        if (key.startsWith(`${String(identityId)}:${String(provider)}:${String(externalId)}`)) {
          data.delete(key);
          deleted++;
        }
      }
      return deleted;
    }

    return 0;
  };

  const transaction = async <T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> => {
    const mockTx: DatabaseConnection = { query, execute };
    return fn(mockTx);
  };

  return { query, execute, transaction };
};

describe("PostgresIdentityStoreAdapter", () => {
  it("should create and find an identity", async () => {
    const dbPort = createMockDbPort();
    const store = new PostgresIdentityStoreAdapter(dbPort);
    
    const identity = {
      id: "test-id",
      tenantId: "test-tenant",
      email: "test@example.com",
      displayName: "Test User",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
      attributes: {},
    };
    
    await store.create(identity);
    
    const result = await store.findById("test-id");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("test-id");
    expect(result?.email).toBe("test@example.com");
  });
  
  it("should find identity by email", async () => {
    const dbPort = createMockDbPort();
    const store = new PostgresIdentityStoreAdapter(dbPort);
    
    const identity = {
      id: "test-id-2",
      tenantId: "test-tenant",
      email: "test2@example.com",
      displayName: "Test User 2",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
      attributes: {},
    };
    
    await store.create(identity);
    
    const result = await store.findByEmail("test2@example.com");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("test-id-2");
    expect(result?.email).toBe("test2@example.com");
  });
  
  it("should update an identity", async () => {
    const dbPort = createMockDbPort();
    const store = new PostgresIdentityStoreAdapter(dbPort);
    
    const identity = {
      id: "test-id-3",
      tenantId: "test-tenant",
      email: "test3@example.com",
      displayName: "Test User 3",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
      attributes: {},
    };
    
    await store.create(identity);
    
    const updatedIdentity = {
      ...identity,
      displayName: "Updated Test User",
      status: "disabled",
      updatedAt: new Date().toISOString(),
    };
    
    await store.update(updatedIdentity);
    
    const result = await store.findById("test-id-3");
    expect(result).not.toBeNull();
    expect(result?.displayName).toBe("Updated Test User");
    expect(result?.status).toBe("disabled");
  });
});