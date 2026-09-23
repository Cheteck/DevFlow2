import { describe, it, expect } from "vitest";
import { HttpContext } from "./http-context";
import { MiddlewarePipeline } from "./middleware-pipeline";
import { ExceptionHandler, type HttpError } from "./exception-handler";
import { Container } from "@mosaix/container";

describe("AdonisJS-inspired HTTP stack in MosaiX", () => {
  it("should process requests through middleware pipeline and HttpContext", async () => {
    const container = new Container();
    const ctx = new HttpContext(
      {
        method: "GET",
        url: "/test",
        headers: {},
        query: {},
        params: {},
        body: null,
      },
      container
    );

    const pipeline = new MiddlewarePipeline();

    // Add middleware 1 (state modifier)
    pipeline.use(async (c, next) => {
      c.state.auth = true;
      return next();
    });

    const handler = async (c: HttpContext) => {
      return c.json({ success: true, authenticated: c.state.auth });
    };

    const res = await pipeline.execute(ctx, handler);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, authenticated: true });
  });

  it("should catch errors with ExceptionHandler", async () => {
    const container = new Container();
    const ctx = new HttpContext(
      {
        method: "GET",
        url: "/error",
        headers: {},
        query: {},
        params: {},
        body: null,
      },
      container
    );

    const handler = async () => {
      const err: HttpError = new Error("Unauthorized access");
      err.status = 401;
      err.code = "E_UNAUTHORIZED";
      throw err;
    };

    const handlerWithErrorHandling = async (c: HttpContext) => {
      try {
        return await handler();
      } catch (err) {
        const handlerObj = new ExceptionHandler();
        return handlerObj.handle(err as HttpError, c);
      }
    };

    const res = await handlerWithErrorHandling(ctx);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        message: "Unauthorized access",
        code: "E_UNAUTHORIZED",
        status: 401,
      },
    });
  });
});
