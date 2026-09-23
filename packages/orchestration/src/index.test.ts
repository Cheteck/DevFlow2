import { describe, expect, it, vi } from "vitest";
import { WorkflowEngine } from "./orchestration";

describe("WorkflowEngine (Saga Orchestration)", () => {
  it("executes all steps when no failure occurs", async () => {
    const engine = new WorkflowEngine<{ count: number }>();
    engine
      .addStep({
        name: "step1",
        execute: (ctx) => {
          ctx.count += 1;
        },
      })
      .addStep({
        name: "step2",
        execute: (ctx) => {
          ctx.count += 2;
        },
      });

    const res = await engine.execute({ count: 0 });
    expect(res.success).toBe(true);
    expect(res.context.count).toBe(3);
  });

  it("compensates previously executed steps on failure", async () => {
    const engine = new WorkflowEngine<{ reserved: boolean; paid: boolean }>();
    const compensateFn = vi.fn((ctx) => {
      ctx.reserved = false;
    });

    engine
      .addStep({
        name: "reserveStock",
        execute: (ctx) => {
          ctx.reserved = true;
        },
        compensate: compensateFn,
      })
      .addStep({
        name: "processPayment",
        execute: () => {
          throw new Error("Payment gateway timeout");
        },
      });

    const res = await engine.execute({ reserved: false, paid: false });
    expect(res.success).toBe(false);
    expect(res.error?.message).toBe("Payment gateway timeout");
    expect(compensateFn).toHaveBeenCalledOnce();
    expect(res.context.reserved).toBe(false);
  });
});
