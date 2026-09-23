import { describe, expect, it } from "vitest";
import { Pipeline } from "./pipeline";

describe("Pipeline Execution Coverage", () => {
  it("processes pipeline middlewares in order", async () => {
    const pipeline = new Pipeline<{ val: number }>();
    pipeline.pipe(async (ctx, next) => {
      ctx.val += 1;
      await next();
    });
    pipeline.pipe(async (ctx, next) => {
      ctx.val *= 2;
      await next();
    });

    const res = await pipeline.process({ val: 5 });
    expect(res.val).toBe(12);
  });
});
