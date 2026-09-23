/**
 * @mosaix/http — OpenAPI v3 Specification Generator
 */

import type { RouteDefinition } from "./http";

export class OpenApiGenerator {
  static generateSpec(title: string, version: string, routes: ReadonlyArray<RouteDefinition>): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of routes) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      const methodLower = route.method.toLowerCase();
      paths[route.path][methodLower] = {
        summary: `Handler for ${route.method} ${route.path}`,
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      };
    }

    return {
      openapi: "3.0.0",
      info: { title, version },
      paths,
    };
  }
}
