/**
 * @mosaix/mcp — Intelligence-backed tool bridge (INT-MCP-01).
 *
 * Composes MCP (secure transport of agent actions) with
 * `@mosaix/intelligence` (probabilistic judgment with guardrails):
 *
 * - each judgment tool declares an intelligence `capability` + optional `AIPolicy`;
 * - the handler runs `IntelligenceRuntime.decide()` on the tool arguments;
 * - `AUTO`/`SUGGEST` → the deterministic `execute` step runs, traced by `decisionId`;
 * - `HUMAN` → nothing executes; the decision goes to `HumanReviewQueue`
 *   (reviewable in Imperia) and the tool returns `review_required`;
 * - `IntelligenceKillSwitch` disables risky capabilities at runtime;
 * - `IntelligenceMetricsCollector` records cost/override per decision.
 *
 * The runtime is injectable so tests never depend on global singletons.
 */

import {
  HumanReviewQueue,
  IntelligenceKillSwitch,
  IntelligenceRuntime,
  type AIPolicy,
  type DecisionResult,
} from "@mosaix/intelligence";
import type { MCPToolRegistry } from "../tool-registry.js";

export interface IntelligenceToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** MCP scope, aligned with the owning BAC permission (e.g. `portfolio:vendable:read:tenant`). */
  requiredPermission: string;
  ownerApp: string;
  /** Intelligence capability backing the judgment (must exist in CapabilityRegistry). */
  capability: string;
  policy?: AIPolicy;
}

export interface IntelligenceToolDeps {
  runtime?: IntelligenceRuntime;
}

export interface IntelligenceToolOutcome {
  status: "completed" | "review_required";
  decisionId: string;
  capability: string;
  confidence: number;
  confidenceLevel: string;
  provider: string;
  result?: unknown;
  reviewId?: string;
}

export function registerIntelligenceTool(  tools: MCPToolRegistry,
  spec: IntelligenceToolSpec,
  execute: (decision: DecisionResult, input: Record<string, unknown>) => Promise<unknown> | unknown,
  deps?: IntelligenceToolDeps,
): void {
  const runtime = deps?.runtime ?? new IntelligenceRuntime();

  tools.registerTool({
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    requiredPermission: spec.requiredPermission,
    ownerApp: spec.ownerApp,
    handler: async (input: unknown): Promise<IntelligenceToolOutcome> => {
      const args = (input ?? {}) as Record<string, unknown>;

      if (IntelligenceKillSwitch.getInstance().isCapabilityDisabled(spec.capability)) {
        throw new Error(`Intelligence capability [${spec.capability}] is disabled by Kill Switch`);
      }

      const decision = await runtime.decide({
        capability: spec.capability,
        state: args,
        policy: spec.policy,
      });

      if (decision.confidenceLevel === "HUMAN") {
        // Runtime enqueues only when the capability supports human review;
        // the bridge guarantees no low-confidence execution either way.
        const existing = HumanReviewQueue.getInstance()
          .listPending()
          .find((item) => item.decisionId === decision.decisionId);
        const review =
          existing ?? HumanReviewQueue.getInstance().enqueue(decision);
        return {
          status: "review_required",
          decisionId: decision.decisionId,
          capability: decision.capability,
          confidence: decision.confidence,
          confidenceLevel: decision.confidenceLevel,
          provider: decision.provider,
          reviewId: review.id,
        };
      }

      return {
        status: "completed",
        decisionId: decision.decisionId,
        capability: decision.capability,
        confidence: decision.confidence,
        confidenceLevel: decision.confidenceLevel,
        provider: decision.provider,
        result: await execute(decision, args),
      };
    },
  });
}

/**
 * Pilot intelligence-backed tools (migration Phase 2).
 * Deterministic BAC tools stay direct (MCP-01); only judgment calls route here.
 * NOTE: `spaces_content_moderate` is gated on `spaces:space:manage` and
 * `commerce_product_classify` on `commerce:order:read` — closest existing
 * manifest scopes until those BACs declare dedicated capabilities.
 */
export class IntelligenceToolProvider {
  static register(tools: MCPToolRegistry, deps?: IntelligenceToolDeps): void {
    registerIntelligenceTool(
      tools,
      {
        name: "portfolio_listing_quality_score",
        description:
          "Scores a Portfolio listing (title/description completeness) via the Intelligence decision engine. Read-only assessment, no mutation.",
        inputSchema: {
          type: "object",
          properties: {
            reference: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["reference", "title"],
        },
        requiredPermission: "portfolio:vendable:read:tenant",
        ownerApp: "@apps/portfolio",
        capability: "commerce.product.quality.score",
      },
      async (decision, input) => ({
        reference: input["reference"],
        score: decision.confidence,
        level: decision.confidenceLevel,
        advice:
          decision.confidenceLevel === "AUTO"
            ? "Listing meets the quality bar."
            : "Listing needs human review before publication.",
      }),
      deps,
    );

    registerIntelligenceTool(
      tools,
      {
        name: "spaces_content_moderate",
        description:
          "Screens Space text for toxicity/spam via the Intelligence decision engine. Returns the moderation verdict, never auto-publishes.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
        requiredPermission: "spaces:space:manage",
        ownerApp: "@apps/spaces",
        capability: "spaces.content.moderate",
      },
      async (decision) => ({
        verdict: decision.value,
        confidence: decision.confidence,
        level: decision.confidenceLevel,
      }),
      deps,
    );

    registerIntelligenceTool(
      tools,
      {
        name: "commerce_product_classify",
        description:
          "Classifies a product title into taxonomy/brand via the Intelligence decision engine. Read-only.",
        inputSchema: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
        requiredPermission: "commerce:order:read",
        ownerApp: "@apps/commerce",
        capability: "commerce.product.classify",
      },
      async (decision, input) => ({
        title: input["title"],
        classification: decision.value,
        confidence: decision.confidence,
        level: decision.confidenceLevel,
      }),
      deps,
    );
  }
}
