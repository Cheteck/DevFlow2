/**
 * @mosaix/cli — Canonical Application Scaffolding Generator (PRD-App Specification)
 */

export class Scaffolder {
  static generateAppManifest(appId: string, name: string): string {
    return JSON.stringify(
      {
        type: "application",
        id: appId,
        name: name,
        version: "1.0.0",
        domain: {
          name: appId,
        },
        runtime: {
          entrypoint: "./src/index.ts",
          isolation: "trusted",
        },
        database: {
          strategy: "per-app",
        },
        capabilities: [
          {
            id: `${appId}.create`,
            version: "1.0.0",
          },
          {
            id: `${appId}.lookup`,
            version: "1.0.0",
          },
        ],
        permissions: [`${appId}:resource:create:tenant`, `${appId}:resource:read:tenant`],
        events: [`${appId}.created`, `${appId}.updated`],
        experience: {
          frontend: {
            entrypoint: "./frontend/src/index.ts",
          },
        },
      },
      null,
      2
    );
  }

  static generateAppEntryPoint(appId: string): string {
    const pascalName = appId.charAt(0).toUpperCase() + appId.slice(1);
    return `/**
 * @apps/${appId} — Canonical Entry Point
 */

import { Container, Router } from "@mosaix/sdk";

export function create${pascalName}Composition(parentContainer?: Container) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  return { container, router };
}
`;
  }

  static generateModel(name: string): string {
    const tableName = `${name.toLowerCase()}s`;
    return `import { Model } from "@mosaix/sdk";

export class ${name} extends Model {
  static override tableName = "${tableName}";

  name!: string;
}
`;
  }

  static generateService(name: string): string {
    return `import { Service } from "@mosaix/sdk";

export class ${name} extends Service {
  async execute(): Promise<void> {
    // Domain service execution logic
  }
}
`;
  }

  static generateCommand(name: string): string {
    return `import type { Command, CommandHandler } from "@mosaix/sdk";

export interface ${name}Payload {
  id: string;
}

export interface ${name}Command extends Command<${name}Payload> {
  commandName: "${name}";
}

export class ${name}Handler implements CommandHandler<${name}Command, void> {
  async handle(command: ${name}Command): Promise<void> {
    // CQRS Command handling logic
  }
}
`;
  }

  static generateController(name: string): string {
    return `import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";

export class ${name}Controller extends Controller {
  async handle(req: HttpRequest): Promise<HttpResponse> {
    return this.json({ status: "ok" });
  }
}
`;
  }

  static generateDockerfile(appId: string): string {
    return `FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm mosaix build ${appId}

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.mosaix/apps/${appId} ./
EXPOSE 3000
CMD ["node", "server/index.js"]
`;
  }

  static generateHelmChart(appId: string): string {
    return `apiVersion: v2
name: ${appId}
description: Helm chart for MosaiX Application ${appId}
type: application
version: 1.0.0
appVersion: "1.0.0"
`;
  }

  static generatePublishConfig(): string {
    return `// MosaiX Package Publisher Configuration
export const publishOrder = [
  "@mosaix/types",
  "@mosaix/contracts",
  "@mosaix/schemas",
  "@mosaix/ports-database",
  "@mosaix/ports-cache",
  "@mosaix/ports-storage",
  "@mosaix/container",
  "@mosaix/config",
  "@mosaix/core",
  "@mosaix/orm",
  "@mosaix/commands",
  "@mosaix/http",
  "@mosaix/events",
  "@mosaix/traits",
  "@mosaix/pipeline",
  "@mosaix/security",
  "@mosaix/orchestration",
  "@mosaix/telemetry",
  "@mosaix/auth",
  "@mosaix/sdk"
];
`;
  }
}
