import type { AdminPageContribution, AdminPageCategory } from "@mosaix/contracts";

/**
 * Registre dynamique des contributions contextuelles et d'administration du Shell.
 * Permet aux BACs d'injecter des actions et des pages d'administration sans couplage statique.
 */

export interface ShellAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  permission?: string;
  badge?: string;
  badgeClass?: string;
}

export type AdminPage = AdminPageContribution;

export interface ContextualActionsContext {
  title: string;
  subtitle: string;
  ctaLabel?: string;
}

export interface ShellContextualContribution {
  bacId: string;
  context: ContextualActionsContext;
  actions: ShellAction[];
}

class ShellRegistry {
  private contributions: Map<string, ShellContextualContribution> = new Map();
  private adminPages: Map<string, AdminPageContribution> = new Map();
  private defaultBacId: string | null = null;

  register(contribution: ShellContextualContribution) {
    this.contributions.set(contribution.bacId, contribution);
  }

  registerAdminPage(page: AdminPageContribution | (Partial<AdminPageContribution> & { id: string; bacId: string; title: string; icon: string; route: string })) {
    const normalized: AdminPageContribution = {
      order: 100,
      category: "operations",
      permission: "admin",
      render: () => `<div class="p-4 text-xs text-on-surface-variant">Vue d'administration pour ${page.title}</div>`,
      ...page
    };
    this.adminPages.set(normalized.id, normalized);
  }

  unregisterAdminPage(id: string) {
    this.adminPages.delete(id);
  }

  setDefaultBacId(bacId: string) {
    this.defaultBacId = bacId;
  }

  getDefaultBacId(): string | null {
    return this.defaultBacId;
  }

  getForBac(bacId: string): ShellContextualContribution | undefined {
    return this.contributions.get(bacId);
  }

  getAllContributions(): ShellContextualContribution[] {
    return Array.from(this.contributions.values());
  }

  getAllAdminPages(): AdminPageContribution[] {
    return Array.from(this.adminPages.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  getAdminPagesByBac(bacId: string): AdminPageContribution[] {
    const cleanId = bacId.replace(/^@apps\//, "");
    return this.getAllAdminPages().filter(p => {
      const pBac = p.bacId.replace(/^@apps\//, "");
      return pBac === cleanId;
    });
  }

  getAdminPagesByCategory(category: AdminPageCategory): AdminPageContribution[] {
    return this.getAllAdminPages().filter(p => p.category === category);
  }

  getAdminPage(id: string): AdminPageContribution | undefined {
    return this.adminPages.get(id);
  }
}

export const shellRegistry = new ShellRegistry();

