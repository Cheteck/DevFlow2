import type { Command, CommandHandler } from "@mosaix/commands";
import type { Space, SpaceService } from "../domain/space.model.js";
import type { SpaceTemplateType } from "../domain/space-template.js";

export interface CreateSpacePayload {
  name: string;
  template: SpaceTemplateType;
  ownerId: string;
  tenantId: string;
  customDomain?: string;
}

export interface CreateSpaceCommand extends Command<CreateSpacePayload> {
  commandName: "CreateSpace";
  payload: CreateSpacePayload;
}

export class CreateSpaceHandler implements CommandHandler<CreateSpaceCommand, Space> {
  constructor(private readonly spaceService: SpaceService) {}

  async handle(command: CreateSpaceCommand): Promise<Space> {
    const { name, template, ownerId, tenantId, customDomain } = command.payload;
    return this.spaceService.createSpaceFromTemplate(name, template, ownerId, tenantId, customDomain);
  }
}
