/**
 * Canonical Route Contract Primitive (Phase 0.1)
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface RouteContract {
  readonly id: string;
  readonly appId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: string;
  readonly permissions?: readonly string[];
}
