import type { HttpContext } from "./http-context";

export type HttpHandler<T = unknown> = (ctx: HttpContext) => Promise<T> | T;
export type MiddlewareFn<T = unknown> = (ctx: HttpContext, next: () => Promise<T>) => Promise<T> | T;

/**
 * @mosaix/core — AdonisJS-inspired Middleware Pipeline
 */
export class MiddlewarePipeline {
  private middlewares: MiddlewareFn[] = [];

  use(middleware: MiddlewareFn): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute<T = unknown>(ctx: HttpContext, handler: HttpHandler<T>): Promise<T> {
    const dispatch = async (i: number): Promise<T> => {
      if (i < this.middlewares.length) {
        const middleware = this.middlewares[i] as MiddlewareFn<T>;
        return middleware(ctx, () => dispatch(i + 1));
      }
      return handler(ctx);
    };

    return dispatch(0);
  }
}
