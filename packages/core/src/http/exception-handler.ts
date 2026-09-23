import type { HttpContext } from "./http-context";

export interface HttpError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * @mosaix/core — AdonisJS-inspired Global Exception Handler
 */
export class ExceptionHandler {
  async handle(error: HttpError, ctx: HttpContext) {
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    const code = error.code || "INTERNAL_SERVER_ERROR";
    const details = error.details;

    if (ctx.logger) {
      ctx.logger.error(`[ExceptionHandler] ${status} - ${message}`, { error: error.stack });
    } else {
      console.error(`[ExceptionHandler] ${status} - ${message}`, error);
    }

    return ctx.json(
      {
        error: {
          message,
          code,
          status,
          ...(details ? { details } : {}),
        },
      },
      status
    );
  }
}
