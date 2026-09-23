/**
 * Citadelle — executable entrypoint (reference demo).
 */

import { RuntimeKernel } from "@mosaix/sdk";
import { createCitadelleApp } from "./index.js";

const TENANT = { id: "acme-corp", organizationId: "acme-corp" };

async function main(): Promise<void> {
  const kernel = new RuntimeKernel();
  await kernel.initialize();

  const { app } = await createCitadelleApp(kernel, TENANT);
  await kernel.start();
  console.log(`[citadelle] app registered: ${app.manifest.id} (ready)`);
  await kernel.stop();
}

main().catch((error) => {
  console.error("[citadelle] fatal:", error);
  process.exitCode = 1;
});
