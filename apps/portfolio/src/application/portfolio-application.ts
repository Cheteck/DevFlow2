/**
 * @apps/portfolio/application — Capability descriptors & versioned event schemas.
 * Implements responsibilities.md § "Responsabilités" (declare versioned capabilities
 * and event schemas, register them at boot) and § "Critères de santé".
 */

import type { MosaixApp } from "@mosaix/sdk";

export const PORTFOLIO_CAPABILITIES = [
  { id: "portfolio.vendable.create", version: "1.0.0" },
  { id: "portfolio.vendable.read", version: "1.0.0" },
  { id: "portfolio.vendable.publish", version: "1.0.0" },
  { id: "portfolio.vendable.search", version: "1.0.0" },
] as const;

export type PortfolioCapabilityId =
  (typeof PORTFOLIO_CAPABILITIES)[number]["id"];

export interface VendableCreatedPayload {
  vendableId: string;
  reference: string;
  type: string;
  status: string;
}

export interface VendablePublishedPayload {
  vendableId: string;
  reference: string;
  status: string;
}

export const PORTFOLIO_EVENT_SCHEMAS = [
  {
    type: "portfolio.vendable.created",
    version: "1.0.0",
    schema: {
      required: ["vendableId", "reference", "type", "status"],
    },
  },
  {
    type: "portfolio.vendable.published",
    version: "1.0.0",
    schema: {
      required: ["vendableId", "reference", "status"],
    },
  },
] as const;

/**
 * Registers the versioned event schemas at boot. Must be called once
 * the MosaixApp is created, before capabilities are executed.
 */
export function registerPortfolioApplication(app: MosaixApp): void {
  for (const schema of PORTFOLIO_EVENT_SCHEMAS) {
    app.registerEventSchema({
      type: schema.type,
      version: schema.version,
      schema: schema.schema as unknown as Record<string, unknown>,
    });
  }
}
