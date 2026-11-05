import { describe, it, expect } from "vitest";
import { RuntimeKernel } from "@mosaix/sdk";
import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import { createCitadelleApp } from "../apps/citadelle/src/index.js";

describe("MosaiX Independent BAC Test — Citadelle Pilot", () => {
  it("fulfills all criteria: boots in isolated kernel, uses database adapter, registers capabilities, and terminates cleanly", async () => {
    // 1. Initialiser un kernel autonome (aucun Shell, aucun autre BAC)
    const kernel = new RuntimeKernel();
    await kernel.initialize();

    // 2. Brancher un adaptateur de base de données SQLite
    const db = new SQLiteDatabaseAdapter({ filename: ":memory:" });

    const tenant = { id: "acme-tenant", organizationId: "acme-corp" };

    // 3. Booter Citadelle via sa factory canonique
    const { app, container } = await createCitadelleApp(kernel, tenant, { databasePort: db });
    await kernel.start();

    expect(app.manifest.id).toBe("@apps/citadelle");
    expect(container.has("kernel")).toBe(true);
    expect(container.has("tenant")).toBe(true);

    // 4. Grant permission for declared capability and event
    kernel.permissions.grant(
      "citadelle:user.lookup:execute:tenant",
      tenant,
      "@apps/citadelle"
    );
    kernel.permissions.grant(
      "citadelle:citadelle.user.created:publish:tenant",
      tenant,
      "@apps/citadelle"
    );

    // Provide and execute declared capability
    app.capabilities.provide("citadelle.user.lookup", (input) => {
      return { found: true, user: input };
    });

    const capRes = await app.capabilities.invoke<{ id: string }, { found: boolean; user: { id: string } }>(
      "citadelle.user.lookup",
      { id: "usr-42" }
    );
    expect(capRes.found).toBe(true);
    expect(capRes.user.id).toBe("usr-42");

    // 5. Enregistrer le schéma et émettre un événement déclaré
    app.events.registerSchema({
      type: "citadelle.user.created",
      version: "1.0.0",
      schema: { safeParse: (data: unknown) => ({ success: true, data }) },
    });

    const envelope = await app.events.publish("citadelle.user.created", "1.0.0", {
      userId: "usr-pilot-1",
      email: "pilot@acme.com",
    });
    expect(envelope.id).toBeDefined();
    expect(envelope.type).toBe("citadelle.user.created");
    expect(envelope.source.application).toBe("@apps/citadelle");

    // 6. Arrêt propre
    await kernel.stop();
  });
});
