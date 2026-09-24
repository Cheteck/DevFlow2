export interface OpenApiPathMethod {
  summary: string;
  description?: string;
  operationId?: string;
  responses: Record<string, { description: string }>;
}

export interface OpenApiSpec {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, OpenApiPathMethod>>;
}

export class OpenApiContractGenerator {
  static generateForApp(manifest: {
    id: string;
    version: string;
    description?: string;
  }, routes: Array<{ path: string; method: string; description?: string }>): OpenApiSpec {
    const paths: Record<string, Record<string, OpenApiPathMethod>> = {};

    for (const r of routes) {
      const normalizedPath = r.path.startsWith("/") ? r.path : `/${r.path}`;
      const method = r.method.toLowerCase();
      if (!paths[normalizedPath]) {
        paths[normalizedPath] = {};
      }
      paths[normalizedPath][method] = {
        summary: r.description ?? `${method.toUpperCase()} ${normalizedPath}`,
        responses: {
          "200": { description: "Successful response" },
          "400": { description: "Bad request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      };
    }

    return {
      openapi: "3.1.0",
      info: {
        title: manifest.id,
        version: manifest.version,
        description: manifest.description,
      },
      paths,
    };
  }
}
