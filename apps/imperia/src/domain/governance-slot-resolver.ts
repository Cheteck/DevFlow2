import { SlotRegistry, type UISlotContribution } from "@mosaix/ui-runtime";

export interface GovernancePageContribution extends UISlotContribution {
  pageId: string;
  pageTitle: string;
  description: string;
  routePath: string;
  requiredPermission?: string;
}

export class GovernanceSlotResolver {
  private slotRegistry: SlotRegistry;

  constructor(slotRegistry?: SlotRegistry) {
    this.slotRegistry = slotRegistry ?? new SlotRegistry();
  }

  registerPageContribution(contribution: {
    applicationId: string;
    entrypoint: string;
    permission?: string;
    order?: number;
  }): void {
    this.slotRegistry.register({
      slot: "imperia.admin.pages",
      applicationId: contribution.applicationId,
      entrypoint: contribution.entrypoint,
      order: contribution.order ?? 10,
      ...(contribution.permission ? { permission: contribution.permission } : {}),
    } as UISlotContribution);
  }

  getGovernancePages(): GovernancePageContribution[] {
    const raw = this.slotRegistry.getSlotContributions("imperia.admin.pages");
    return raw.map((item) => {
      const pageId = item.entrypoint.split("/").pop() ?? "admin-page";
      const contribution: GovernancePageContribution = {
        slot: item.slot,
        applicationId: item.applicationId,
        entrypoint: item.entrypoint,
        order: item.order ?? 10,
        pageId,
        pageTitle: `${item.applicationId.toUpperCase()} Admin (${pageId})`,
        description: `Page d'administration contribuée par l'application ${item.applicationId}`,
        routePath: `/imperia/apps/${item.applicationId}/admin/${pageId}`,
      };
      if (item.permission) {
        contribution.permission = item.permission;
        contribution.requiredPermission = item.permission;
      }
      return contribution;
    });
  }
}
