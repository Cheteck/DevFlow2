import { describe, expect, it } from "vitest";
import type {
  DatabaseCapabilities,
  DatabasePort,
  MigrationLock,
} from "@mosaix/ports-database";
import { CouponRepository } from "./coupon-repository.js";
import type { Coupon } from "../domain/subscription-billing-engine.js";

function makeCapabilities(dialect: "sqlite" | "postgres"): DatabaseCapabilities {
  return {
    dialect,
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };
}

/** Fake en mémoire : stocke les lignes `coupons` par `code`. */
class InMemoryCouponDb implements DatabasePort {
  readonly capabilities: DatabaseCapabilities;
  readonly rows = new Map<string, Record<string, unknown>>();
  executedSql: string[] = [];

  constructor(dialect: "sqlite" | "postgres" = "sqlite") {
    this.capabilities = makeCapabilities(dialect);
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    this.executedSql.push(sql);
    const p = [...(params ?? [])];
    // INSERT INTO coupons (id, code, discountPercent, discountAmountInCents,
    //   maxRedemptions, redemptionsCount, expiresAt, createdAt)
    this.rows.set(String(p[1]), {
      id: p[0],
      code: p[1],
      discountPercent: p[2],
      discountAmountInCents: p[3],
      maxRedemptions: p[4],
      redemptionsCount: p[5],
      expiresAt: p[6],
      createdAt: p[7],
    });
    return 1;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    this.executedSql.push(sql);
    const row = this.rows.get(String(params?.[0]));
    return (row ? [row] : []) as unknown as T[];
  }

  async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    return { release: async () => {} };
  }
}

const SAMPLE: Coupon = {
  id: "cpn_1",
  code: "WELCOME20",
  discountPercent: 20,
  discountAmountInCents: null,
  maxRedemptions: 100,
  redemptionsCount: 0,
  expiresAt: null,
  createdAt: "2026-09-26T00:00:00.000Z",
};

describe("CouponRepository", () => {
  it("insert puis findByCode restitue le coupon (round-trip)", async () => {
    const db = new InMemoryCouponDb("sqlite");
    const repo = new CouponRepository(db);

    await repo.insert(SAMPLE);
    const found = await repo.findByCode("WELCOME20");

    expect(found).toEqual(SAMPLE);
  });

  it("findByCode retourne null pour un code inconnu", async () => {
    const db = new InMemoryCouponDb("sqlite");
    const repo = new CouponRepository(db);

    await expect(repo.findByCode("NOPE")).resolves.toBeNull();
  });

  it("émet des placeholders '?' en sqlite et '$n' en postgres", async () => {
    const sqliteDb = new InMemoryCouponDb("sqlite");
    await new CouponRepository(sqliteDb).insert(SAMPLE);
    expect(sqliteDb.executedSql[0]).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    const pgDb = new InMemoryCouponDb("postgres");
    await new CouponRepository(pgDb).insert(SAMPLE);
    expect(pgDb.executedSql[0]).toContain("VALUES ($1, $2, $3, $4, $5, $6, $7, $8)");

    await new CouponRepository(pgDb).findByCode("WELCOME20");
    expect(pgDb.executedSql[1]).toContain("code = $1");
  });
});
