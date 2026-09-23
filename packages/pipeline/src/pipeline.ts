/**
 * @mosaix/pipeline — Generalized Pipeline System
 */

export type Middleware<TContext = unknown> = (
  context: TContext,
  next: () => Promise<unknown>
) => Promise<unknown> | unknown;

export class Pipeline<TContext = unknown> {
  private middlewares: Middleware<TContext>[] = [];

  pipe(middleware: Middleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  async process(context: TContext): Promise<TContext> {
    let index = -1;

    const dispatch = async (i: number): Promise<unknown> => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      if (i === this.middlewares.length) {
        return context;
      }

      const middleware = this.middlewares[i];
      if (!middleware) {
        throw new Error("Middleware not found at index " + i);
      }
      return middleware(context, () => dispatch(i + 1));
    };

    await dispatch(0);
    return context;
  }
}
