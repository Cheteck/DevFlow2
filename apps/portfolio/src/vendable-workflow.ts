/**
 * @apps/portfolio — Vendable Workflow Engine Integration
 */

import { WorkflowEngine } from "@mosaix/sdk";

export interface VendableWorkflowContext {
  vendableId: string;
  status: "Draft" | "In Review" | "Validated" | "Published" | "Archived";
  qualityPassed?: boolean;
}

export class VendableWorkflow {
  private engine = new WorkflowEngine<VendableWorkflowContext>();

  constructor() {
    this.engine
      .addStep({
        name: "validateCompleteness",
        execute: (ctx) => {
          if (!ctx.qualityPassed) {
            throw new Error("Vendable completeness validation failed.");
          }
        },
      })
      .addStep({
        name: "publishVendable",
        execute: (ctx) => {
          ctx.status = "Published";
        },
        compensate: (ctx) => {
          ctx.status = "Draft";
        },
      });
  }

  async publish(context: VendableWorkflowContext) {
    return this.engine.execute(context);
  }
}
