import type { Container } from "@mosaix/container";
import type { Logger } from "../observability";

/**
 * @mosaix/core — AdonisJS-inspired HTTP Context
 * Encapsulates request, response, logger, container, and state for a single request.
 */
export class HttpContext {
  public status = 200;
  public headers: Record<string, string> = {};
  public state: Record<string, unknown> = {};

  constructor(
    public readonly request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      query: Record<string, unknown>;
      params: Record<string, string>;
      body: unknown;
    },
    public readonly container: Container,
    public readonly logger?: Logger,
    public user?: unknown
  ) {}

  json(data: unknown, status = this.status): { status: number; body: unknown; headers: Record<string, string> } {
    return {
      status,
      headers: { "Content-Type": "application/json", ...this.headers },
      body: data,
    };
  }

  error(message: string, status = 400, details?: unknown): { status: number; body: unknown; headers: Record<string, string> } {
    return {
      status,
      headers: { "Content-Type": "application/json", ...this.headers },
      body: { error: message, details, status },
    };
  }
}
