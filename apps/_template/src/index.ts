import { Router } from "@mosaix/http";
import { Container } from "@mosaix/container";
import type { MosaixApp, RuntimeKernel } from "@mosaix/sdk";

export const MANIFEST = {
  id: "@apps/__APP_ID__",
  name: "__APP_NAME__",
  version: "0.1.0",
  routes: { prefix: "/api/__APP_ID__" }
};

export class TemplateServiceProvider {
  static readonly commandName = "__APP_ID__";

  register(container: Container): void {
    container.bind("__APP_ID__Service", () => ({ status: "active", initializedAt: new Date().toISOString() }));
  }

  boot(container: Container, router: Router): MosaixApp {
    router.get("/health", () => {
      return { status: "ok", app: MANIFEST.id, version: MANIFEST.version };
    });

    router.get("/items", () => {
      return { items: [] };
    });

    router.post("/items", (req: { body?: unknown }) => {
      return { success: true, id: `item_${Date.now()}`, data: req.body };
    });

    return {
      manifest: MANIFEST,
      status: "active"
    };
  }

  async shutdown(): Promise<void> {
    // Cleanup any active connections / background workers
  }
}

export function createTemplateComposition(parentContainer?: Container) {
  const container = new Container(parentContainer);
  const router = new Router();
  const provider = new TemplateServiceProvider();
  provider.register(container);
  const app = provider.boot(container, router);
  return { container, router, app, provider };
}

export function createTemplateApp(_kernel?: RuntimeKernel, _tenant?: string) {
  const { app } = createTemplateComposition();
  return app;
}
