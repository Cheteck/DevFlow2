import { OtpDatabaseAdapter } from "./index.js";
import type { OtpRecord, OtpLookupKey } from "@mosaix/otp";
import type { DatabasePort, DatabaseConnection, MigrationLock } from "@mosaix/ports-database";

/** Simple in‑memory mock implementing DatabasePort */
class MockDatabase implements DatabasePort {
  capabilities = { dialect: "sqlite" as const, transactions: true, lock: { distributed: false, processSafe: true, runtimeSafe: true } };
  private store = new Map<string, OtpRecord>();

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    // Very naive parsing based on the known queries used by the adapter
    const s = sql.trim().toUpperCase();
    if (s.startsWith("INSERT")) {
      // Params order matches save()
      const [id, tenantId, destination, channel, purpose, userId, codeHash, createdAt, expiresAt, attempts, maxAttempts] = params!;
      this.store.set(id as string, {
        id: id as string,
        tenantId: tenantId as string,
        destination: destination as string,
        channel: channel as any,
        purpose: purpose as any,
        userId: userId as string | undefined,
        codeHash: codeHash as string,
        createdAt: createdAt as number,
        expiresAt: expiresAt as number,
        attempts: attempts as number,
        maxAttempts: maxAttempts as number,
        // other optional fields are undefined initially
      } as OtpRecord);
      return 1;
    }
    if (s.startsWith("UPDATE OTP SET CONSUMED_AT = ? WHERE ID = ? AND CODE_HASH =")) {
      const [consumedAt, id, codeHash] = params!;
      const rec = this.store.get(id as string);
      if (!rec) return 0;
      if (rec.codeHash !== codeHash) return 0;
      (rec as any).consumedAt = consumedAt;
      return 1;
    }
    if (s.startsWith("UPDATE OTP SET CONSUMED_AT = ? WHERE TENANT_ID =")) {
      // Invalidate active
      const [now, tenantId, destination, purpose, userId] = params!;
      let affected = 0;
      for (const rec of this.store.values()) {
        if (
          rec.tenantId === tenantId &&
          rec.destination === destination &&
          rec.purpose === purpose &&
          (userId ? rec.userId === userId : true) &&
          rec.consumedAt === undefined
        ) {
          (rec as any).consumedAt = now;
          affected++;
        }
      }
      return affected;
    }
    if (s.startsWith("UPDATE OTP SET CONSUMED_AT")) {
      const [consumedAt, id] = params!;
      const rec = this.store.get(id as string);
      if (!rec) return 0;
      (rec as any).consumedAt = consumedAt;
      return 1;
    }
    if (s.startsWith("UPDATE OTP SET ATTEMPTS = ATTEMPTS + 1")) {
      const [id] = params!;
      const rec = this.store.get(id as string);
      if (!rec) return 0;
      rec.attempts += 1;
      return 1;
    }
    if (s.startsWith("DELETE FROM OTP WHERE EXPIRES_AT <")) {
      const [now] = params!;
      let count = 0;
      for (const [key, rec] of this.store.entries()) {
        if (rec.expiresAt < (now as number)) {
          this.store.delete(key);
          count++;
        }
      }
      return count;
    }
    return 0;
  }

  async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]> {
    const s = sql.trim().toUpperCase();
    if (s.startsWith("SELECT * FROM OTP WHERE ID =")) {
      const [id] = params!;
      const rec = this.store.get(id as string) as any;
      return rec ? [rec] : [];
    }
    // generic fallback – not used in tests
    return [] as T[];
  }

  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    // In this mock, tx is the same mock (no real transaction semantics)
    return fn(this as unknown as DatabaseConnection);
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    return { release: async () => {} };
  }
}

describe("OtpDatabaseAdapter", () => {
  const db = new MockDatabase();
  const adapter = new OtpDatabaseAdapter(db);
  const now = Date.now();
  const sample: OtpRecord = {
    id: "otp-1",
    tenantId: "t1",
    destination: "user@example.com",
    channel: "email",
    purpose: "login",
    userId: undefined,
    codeHash: "hash",
    createdAt: now,
    expiresAt: now + 60000,
    attempts: 0,
    maxAttempts: 5,
  };

  test("save & findById", async () => {
    await adapter.save(sample);
    const found = await adapter.findById(sample.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(sample.id);
  });

  test("invalidateActive", async () => {
    const key: OtpLookupKey = { tenantId: "t1", destination: "user@example.com", purpose: "login" };
    const affected = await adapter.invalidateActive(key);
    expect(affected).toBe(1);
  });

  test("invalidateById", async () => {
    await adapter.save(sample);
    await adapter.invalidateById(sample.id);
    const rec = await adapter.findById(sample.id);
    expect((rec as any).consumedAt).toBeDefined();
  });

  test("consumeAtomically success", async () => {
    await adapter.save(sample);
    const res = await adapter.consumeAtomically(sample.id, sample.codeHash, Date.now());
    expect(res.consumed).toBe(true);
  });

  test("incrementAttemptsAtomically", async () => {
    await adapter.save(sample);
    const inc = await adapter.incrementAttemptsAtomically(sample.id, Date.now());
    expect(inc.attempts).toBe(1);
    expect(inc.maxReached).toBe(false);
  });

  test("deleteExpired", async () => {
    const old = { ...sample, id: "old", expiresAt: now - 1000 };
    await adapter.save(old);
    const removed = await adapter.deleteExpired(Date.now());
    expect(removed).toBeGreaterThanOrEqual(1);
    const check = await adapter.findById("old");
    expect(check).toBeNull();
  });

  test("runInTransaction", async () => {
    const result = await adapter.runInTransaction(async (repo) => {
      const rec = await repo.findById(sample.id);
      return rec ? rec.id : null;
    });
    expect(result).toBe(sample.id);
  });
});
