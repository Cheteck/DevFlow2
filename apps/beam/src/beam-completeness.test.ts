import { describe, expect, it } from "vitest";
import { BeamMessagingService } from "./domain/messaging.model.js";
import { PostgresMessagingRepository } from "./infrastructure/postgres-messaging-repository.js";
import {
  PostgresBeamNotificationRepository,
  PostgresBeamPushSubscriptionRepository,
} from "./infrastructure/postgres-beam-notifications-repository.js";
import { createBeamComposition } from "./composition-root.js";

function makeFakeDb() {
  const tables = new Map<string, Array<Record<string, unknown>>>();
  const colsOf = (sql: string): string[] => {
    const m = sql.match(/INSERT INTO \S+ \(([^)]+)\)/);
    return m?.[1]?.split(",").map((c) => c.trim().replaceAll('"', "")) ?? [];
  };
  const db = {
    capabilities: {
      dialect: "postgres",
      transactions: true,
      lock: { distributed: true, processSafe: true, runtimeSafe: true },
    },
    queries: [] as string[],
    async execute() {
      return 0;
    },
    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      db.queries.push(sql);
      if (sql.startsWith("INSERT INTO beam_messages")) {
        const c = colsOf(sql);
        const row: Record<string, unknown> = {};
        c.forEach((k, i) => {
          row[k] = params[i];
        });
        const arr = tables.get("beam_messages") ?? [];
        const ix = arr.findIndex((r) => r["id"] === row["id"]);
        if (ix >= 0) arr[ix] = { ...arr[ix], ...row };
        else arr.push(row);
        tables.set("beam_messages", arr);
        return [];
      }
      if (sql.startsWith("SELECT") && sql.includes("FROM beam_messages")) {
        const arr = tables.get("beam_messages") ?? [];
        const conv = params[0] as string;
        const lim = Number(params[1] ?? 50);
        return arr
          .filter((r) => r["conversationId"] === conv)
          .slice(-lim)
          .reverse() as T[];
      }
      if (sql.startsWith("INSERT INTO beam_conversations")) {
        const arr = tables.get("beam_conversations") ?? [];
        const row = { id: params[0], type: params[1], participants: params[2], createdAt: params[3], data: params[4] };
        const ix = arr.findIndex((r) => r["id"] === row.id);
        if (ix >= 0) arr[ix] = { ...arr[ix], ...row };
        else arr.push(row);
        tables.set("beam_conversations", arr);
        return [];
      }
      if (sql.includes("FROM beam_conversations")) {
        return (tables.get("beam_conversations") ?? []) as T[];
      }
      if (sql.startsWith("INSERT INTO beam_notifications")) {
        const arr = tables.get("beam_notifications") ?? [];
        const row = {
          id: params[0], userId: params[1], title: params[2], body: params[3],
          type: params[4], isRead: params[5], data: params[6], createdAt: params[7],
        };
        const ix = arr.findIndex((r) => r["id"] === row.id);
        if (ix >= 0) arr[ix] = { ...arr[ix], ...row };
        else arr.push(row);
        tables.set("beam_notifications", arr);
        return [];
      }
      if (sql.includes("FROM beam_notifications")) {
        return (tables.get("beam_notifications") ?? []).filter((r) => r["userId"] === params[0]) as T[];
      }
      if (sql.startsWith("UPDATE beam_notifications")) {
        const row = (tables.get("beam_notifications") ?? []).find((r) => r["id"] === params[0]);
        if (row) row["isRead"] = true;
        return [];
      }
      if (sql.startsWith("INSERT INTO beam_push_subscriptions")) {
        const arr = tables.get("beam_push_subscriptions") ?? [];
        const row = {
          id: params[0], userId: params[1], endpoint: params[2],
          p256dh: params[3], auth: params[4], createdAt: params[5],
        };
        const ix = arr.findIndex((r) => r["id"] === row.id);
        if (ix >= 0) arr[ix] = { ...arr[ix], ...row };
        else arr.push(row);
        tables.set("beam_push_subscriptions", arr);
        return [];
      }
      if (sql.startsWith("DELETE FROM beam_push_subscriptions")) {
        tables.set(
          "beam_push_subscriptions",
          (tables.get("beam_push_subscriptions") ?? []).filter((r) => r["id"] !== params[0]),
        );
        return [];
      }
      if (sql.includes("FROM beam_push_subscriptions")) {
        return (tables.get("beam_push_subscriptions") ?? []).filter((r) => r["userId"] === params[0]) as T[];
      }
      throw new Error(`SQL non mocké: ${sql.slice(0, 80)}`);
    },
    async transaction<T>(fn: (tx: never) => Promise<T>): Promise<T> {
      return fn({ query: db.query.bind(db), execute: db.execute.bind(db) } as never);
    },
    async acquireMigrationLock() {
      return { release: async () => {} };
    },
  };
  return db;
}

describe("beam BAC completeness (vérification temporaire)", () => {
  it("persiste et hydrate les 12 colonnes de beam_messages", async () => {
    const db = makeFakeDb();
    const repo = new PostgresMessagingRepository(db as never);
    await repo.saveMessage({
      id: "msg-1", conversationId: "conv-1", senderId: "u1", content: "hello",
      sentAt: new Date().toISOString(),
      replyToMessageId: "msg-0", threadId: "thr-1",
      reactions: { "👍": ["u2"] },
      attachments: [{ id: "a1", type: "image", url: "https://x/y.png", sizeBytes: 12, filename: "y.png" }],
      encryptedPayload: {
        algorithm: "AES-256-GCM", ivHex: "aa", ciphertextHex: "bb", authTagHex: "cc", senderPublicKeyHex: "dd",
      },
      editedAt: null, deletedAt: null,
    });
    expect(db.queries[0]).toContain('"replyToMessageId"');
    expect(db.queries[0]).toContain('"encryptedPayload"');
    const msgs = await repo.getMessages("conv-1");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.replyToMessageId).toBe("msg-0");
    expect(msgs[0]?.threadId).toBe("thr-1");
    expect(msgs[0]?.reactions?.["👍"]?.[0]).toBe("u2");
    expect(msgs[0]?.attachments?.[0]?.filename).toBe("y.png");
    expect(msgs[0]?.encryptedPayload?.ivHex).toBe("aa");
  });

  it("title round-trip via data JSON + sendMessage options rétrocompatibles", async () => {
    const db = makeFakeDb();
    const repo = new PostgresMessagingRepository(db as never);
    const svc = new BeamMessagingService(repo);
    const conv = await svc.createConversation("group", ["u1", "u2"], "Salon Test");
    expect(conv.title).toBe("Salon Test");
    const msg = await svc.sendMessage(conv.id, "u1", "coucou", { threadId: "t1", replyToMessageId: "m0" });
    expect(msg.threadId).toBe("t1");
    const back = await repo.getConversation(conv.id);
    expect(back?.title).toBe("Salon Test");
    const msg2 = await svc.sendMessage(conv.id, "u1", "simple");
    expect(msg2.threadId).toBeUndefined();
  });

  it("notifications save/markRead/listByUser + push save/remove/listByUser", async () => {
    const db = makeFakeDb();
    const notifs = new PostgresBeamNotificationRepository(db as never);
    await notifs.save({ id: "n1", userId: "u1", title: "T", body: "B", type: "info", isRead: false, createdAt: new Date().toISOString() });
    expect(await notifs.listByUser("u1")).toHaveLength(1);
    await notifs.markRead("n1");
    expect((await notifs.listByUser("u1"))[0]?.isRead).toBe(true);
    const push = new PostgresBeamPushSubscriptionRepository(db as never);
    await push.save({ id: "p1", userId: "u1", endpoint: "https://push/x", p256dh: "k", auth: "a", createdAt: new Date().toISOString() });
    expect(await push.listByUser("u1")).toHaveLength(1);
    await push.remove("p1");
    expect(await push.listByUser("u1")).toHaveLength(0);
  });

  it("wiring databasePort jusqu'au provider via composition-root", () => {
    const db = makeFakeDb();
    const comp = createBeamComposition(undefined, { databasePort: db as never });
    expect(() => comp.container.resolve("postgresMessagingRepository")).not.toThrow();
    expect(() => comp.container.resolve("postgresBeamNotificationRepository")).not.toThrow();
    expect(() => comp.container.resolve("postgresBeamPushSubscriptionRepository")).not.toThrow();
    const comp2 = createBeamComposition();
    expect(() => comp2.container.resolve("postgresMessagingRepository")).toThrow();
  });
});
