import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { SpaceService, type SpaceTeamMember } from "../domain/space.model.js";
import { SpaceTemplateRegistry, type SpaceTemplateType } from "../domain/space-template.js";
import { ActingAsSpaceEngine } from "../domain/acting-as-space.js";

export class SpaceController extends Controller {
  private templateRegistry = new SpaceTemplateRegistry();

  constructor(
    private spaceService: SpaceService = new SpaceService(),
    private actingEngine: ActingAsSpaceEngine = new ActingAsSpaceEngine()
  ) {
    super();
  }

  async listTemplates(_req: HttpRequest): Promise<HttpResponse> {
    return this.json({ templates: this.templateRegistry.listTemplates() });
  }

  async listSpaces(req: HttpRequest): Promise<HttpResponse> {
    const tenantId = (req.headers["x-tenant-id"] || req.query?.["tenantId"]) as string | undefined;
    const spaces = await this.spaceService.listSpacesAsync(tenantId);
    return this.json({ spaces });
  }

  async createSpace(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as {
      name: string;
      template: SpaceTemplateType;
      ownerId: string;
      tenantId?: string;
    };

    if (!body || !body.name || !body.template || !body.ownerId) {
      return this.badRequest("name, template and ownerId are required.");
    }

    const tenantId = body.tenantId ?? (req.headers["x-tenant-id"] as string) ?? "tenant-default";
    const space = this.spaceService.createSpaceFromTemplate(
      body.name,
      body.template,
      body.ownerId,
      tenantId
    );

    return this.created({ message: "Space créé avec succès depuis le template", space });
  }

  async addCapability(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { spaceId: string; capability: string };
    if (!body || !body.spaceId || !body.capability) {
      return this.badRequest("spaceId and capability are required.");
    }

    try {
      const space = await this.spaceService.addCapability(body.spaceId, body.capability);
      return this.json({ message: `Capability [${body.capability}] activée pour le Space`, space });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
  }

  async addTeamMember(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { spaceId: string; member: SpaceTeamMember };
    if (!body || !body.spaceId || !body.member) {
      return this.badRequest("spaceId and member object are required.");
    }

    try {
      const space = await this.spaceService.addTeamMember(body.spaceId, body.member);
      return this.json({ message: `Collaborateur [${body.member.userId}] ajouté à l'équipe du Space`, space });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
  }

  async actAsSpace(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as {
      realUserId: string;
      spaceId: string;
      activity: "social" | "messaging" | "commerce" | "booking" | "events";
      actionName: string;
      actionDetails: Record<string, unknown>;
    };

    if (!body || !body.realUserId || !body.spaceId || !body.activity || !body.actionName) {
      return this.badRequest("realUserId, spaceId, activity and actionName are required.");
    }

    try {
      const space = await this.spaceService.getSpaceAsync(body.spaceId);
      if (!space) return this.badRequest(`Space [${body.spaceId}] non trouvé.`);

      const member = space.team.find((m) => m.userId === body.realUserId);
      if (!member) return this.badRequest(`L'utilisateur [${body.realUserId}] ne fait pas partie de l'équipe du Space.`);

      const result = await this.actingEngine.executeActionAsSpace(
        body.realUserId,
        body.spaceId,
        member.role,
        body.actionName
      );

      return this.json({
        message: `Action [${body.actionName}] exécutée au nom du Space [${space.name}] par l'utilisateur [${body.realUserId}]`,
        auditEvent: result,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
  }
}
