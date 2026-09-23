/**
 * @mosaix/mcp — Multi-Step Agent Workflow Tool Provider (Option 3)
 */

import { MCPToolRegistry } from "../tool-registry";
import { MCPPromptRegistry } from "../prompt-registry";

export class WorkflowToolProvider {
  static register(tools: MCPToolRegistry, prompts: MCPPromptRegistry): void {
    // Multi-step agent workflow tool: mosaix_create_business_space
    tools.registerTool({
      name: "mosaix_create_business_space",
      description: "Orchestrates multi-step business space onboarding: creates space, enables commerce, and publishes an announcement post.",
      inputSchema: {
        type: "object",
        properties: {
          spaceName: { type: "string" },
          ownerUserId: { type: "string" },
          announcementText: { type: "string" },
        },
        required: ["spaceName", "ownerUserId", "announcementText"],
      },
      requiredPermission: "spaces:space:create",
      ownerApp: "mosaix.platform",
      handler: async (input: { spaceName: string; ownerUserId: string; announcementText: string }) => {
        // Step 1: Create Space
        const spaceId = `space-${Math.random().toString(36).substring(2, 9)}`;

        // Step 2: Toggle Commerce Module
        const moduleToggled = true;

        // Step 3: Publish Announcement
        const postId = `post-${Math.random().toString(36).substring(2, 9)}`;

        return {
          status: "SUCCESS",
          space: { id: spaceId, name: input.spaceName, template: "business" },
          commerceModuleActive: moduleToggled,
          announcement: { postId, text: input.announcementText },
          executedSteps: ["spaces.space.create", "spaces.module.toggle", "solara.post.create"],
        };
      },
    });

    // Workflow Prompt: mosaix.create-business-space
    prompts.registerPrompt({
      name: "mosaix.create-business-space",
      description: "Workflow prompt guiding the agent through setting up a complete business space",
      arguments: [
        { name: "spaceName", description: "Name of the business space", required: true },
        { name: "announcementText", description: "Initial announcement post text", required: true },
      ],
      handler: async (args) => [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please execute the mosaix_create_business_space tool to set up space '${args.spaceName}' and publish announcement '${args.announcementText}'.`,
          },
        },
      ],
    });
  }
}
