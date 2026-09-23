/**
 * @mosaix/mcp — Platform & Kernel Tool/Resource Provider
 */

import { MCPToolRegistry } from "../tool-registry";
import { MCPResourceRegistry } from "../resource-registry";
import { capabilityRegistry, contextRegistry, runtimeLifecycleEngine } from "@mosaix/core";

export class PlatformToolProvider {
  static register(tools: MCPToolRegistry, resources: MCPResourceRegistry): void {
    // 1. Resources
    resources.registerResource({
      uri: "mosaix://apps",
      name: "MosaiX Registered Applications",
      description: "Lists all registered Bounded Application Contexts (BACs) in ContextRegistry",
      mimeType: "application/json",
      requiredPermission: "mosaix:read",
      resolver: async () => contextRegistry.list(),
    });

    resources.registerResource({
      uri: "mosaix://capabilities",
      name: "MosaiX Active Capabilities",
      description: "Lists all active capabilities registered in CapabilityRegistry",
      mimeType: "application/json",
      requiredPermission: "mosaix:read",
      resolver: async () => capabilityRegistry.listActive(),
    });

    resources.registerResource({
      uri: "mosaix://runtime",
      name: "MosaiX Runtime Lifecycle State",
      description: "Lists runtime component states from RuntimeComponentLifecycleEngine",
      mimeType: "application/json",
      requiredPermission: "mosaix:read",
      resolver: async () => runtimeLifecycleEngine.listComponents(),
    });

    // 2. Tools
    tools.registerTool({
      name: "platform_get_topology",
      description: "Returns the platform topology including registered BACs and active capabilities",
      inputSchema: { type: "object", properties: {} },
      requiredPermission: "platform:admin:read",
      ownerApp: "@mosaix/core",
      handler: async () => ({
        apps: contextRegistry.list(),
        capabilities: capabilityRegistry.listActive(),
        components: runtimeLifecycleEngine.listComponents(),
      }),
    });
  }
}
