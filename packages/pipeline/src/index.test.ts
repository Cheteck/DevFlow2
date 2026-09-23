import { describe, expect, it } from "vitest";
import { Pipeline } from "./pipeline";

describe("Pipeline", () => {
  it("executes middlewares sequentially onion-style", async () => {
    const pipeline = new Pipeline<{ logs: string[] }>();

    pipeline.pipe(async (ctx, next) => {
      ctx.logs.push("m1-start");
      await next();
      ctx.logs.push("m1-end");
    });

    pipeline.pipe(async (ctx, next) => {
      ctx.logs.push("m2-start");
      await next();
      ctx.logs.push("m2-end");
    });

    const result = await pipeline.process({ logs: [] });

    expect(result.logs).toEqual(["m1-start", "m2-start", "m2-end", "m1-end"]);
  });
});
