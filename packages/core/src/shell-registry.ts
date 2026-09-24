import type { AdminPageContribution, AdminPageCategory } from "@mosaix/contracts";

/**
 * Registre dynamique des contributions contextuelles, de navigation et d'administration du Shell.
 * Permet aux BACs d'injecter des actions, des items de navigation et des pages d'administration sans couplage statique.
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

export interface NavigationItemContribution {
  bacId: string;
  label: string;
  icon: string;
  route: string;
  permission?: string;
  category?: string;
  order?: number;
}

class ShellRegistry {
  private contributions: Map<string, ShellContextualContribution> = new Map();
  private adminPages: Map<string, AdminPageContribution> = new Map();
  private navigationItems: Map<string, NavigationItemContribution> = new Map();
  private defaultBacId: string | null = null;

  register(contribution: ShellContextualContribution) {
    this.contributions.set(contribution.bacId, contribution);
  }

  registerNavigationItem(item: NavigationItemContribution) {
    const cleanId = item.bacId.replace(/^@apps\//, "");
    this.navigationItems.set(cleanId, {
      ...item,
      order: item.order ?? 100,
    });
    this.navigationItems.set(item.bacId, item);
  }

  getNavigationItems(): NavigationItemContribution[] {
    const unique = new Map<string, NavigationItemContribution>();
    for (const [key, val] of this.navigationItems.entries()) {
      const cleanKey = key.replace(/^@apps\//, "");
      if (!unique.has(cleanKey)) {
        unique.set(cleanKey, val);
      }
    }
    return Array.from(unique.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  getIconForBac(bacId: string, fallback = "📦"): string {
    const cleanId = bacId.replace(/^@apps\//, "");
    const item = this.navigationItems.get(cleanId) || this.navigationItems.get(bacId);
    return item?.icon || fallback;
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
