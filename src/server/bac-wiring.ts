/**
 * @server — BAC descriptor wiring (composition root helper).
 *
 * Connects BAC presentation descriptors to their domain services backed by
 * the boot database adapter. Called once at boot from `src/start.ts`.
 * Mirrors the `mcp-routes.ts` dynamic-import pattern: BAC modules are loaded
 * lazily so a missing/broken BAC never prevents the shell from booting —
 * the static descriptor fallback (honest empty states) stays in place and
 * the failure is logged loudly.
 *
 * Encapsulation: the server only imports each BAC's public composition
 * contract (`apps/<bac>/src/composition-root.ts`) — never its internal
 * `domain/`, `infrastructure/` or `presentation/` layers (enforced by
 * `eslint.config.mjs`, `server` boundary).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { bacOrchestrator } from "../shell/orchestrator/bac-orchestrator.js";

export async function wireBacDescriptors(db: DatabasePort): Promise<void> {
  await Promise.all([wireCommerceDescriptor(db), wireSpacesDescriptor(db)]);
}

async function wireCommerceDescriptor(db: DatabasePort): Promise<void> {
  try {
    const { createCommerceWiredDescriptor } = await import(
      "../../apps/commerce/src/composition-root.js"
    );
    bacOrchestrator.registerDynamicLoader("commerce", async () =>
      createCommerceWiredDescriptor(db),
    );
  } catch (err) {
    console.error("[bac-wiring] commerce descriptor not wired (static fallback):", err);
  }
}

async function wireSpacesDescriptor(db: DatabasePort): Promise<void> {
  try {
    const { createSpacesWiredDescriptor } = await import(
      "../../apps/spaces/src/composition-root.js"
    );
    bacOrchestrator.registerDynamicLoader("spaces", async () =>
      createSpacesWiredDescriptor(db),
    );
  } catch (err) {
    console.error("[bac-wiring] spaces descriptor not wired (static fallback):", err);
  }
}
