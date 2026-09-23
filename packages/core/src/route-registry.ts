/**
 * Route Registry (Phase 4 — HTTP & Routing)
 */

import type { RouteContract } from "@mosaix/contracts";
import { RegistrationError } from "./kernel-errors";

export class RouteRegistry {
  private readonly routes = new Map<string, RouteContract>();

  registerRoute(route: RouteContract): void {
    const key = `${route.method}:${route.path}`;
    if (this.routes.has(key)) {
      const existing = this.routes.get(key)!;
      throw new RegistrationError(
        `Route conflict detected for ${key} between ${existing.appId} and ${route.appId}`,
        { method: route.method, path: route.path, appA: existing.appId, appB: route.appId },
      );
    }
    this.routes.set(key, route);
  }

  getRoute(method: string, path: string): RouteContract | undefined {
    return this.routes.get(`${method}:${path}`);
  }

  listRoutes(): RouteContract[] {
    return Array.from(this.routes.values());
  }
}
