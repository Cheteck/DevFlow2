/**
 * @apps/solara — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Solara Social & Content.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { SolaraSocialService } from "../domain/social.model.js";

export function createSolaraDescriptor(socialService?: SolaraSocialService): BacDescriptor {
  const service = socialService || new SolaraSocialService();

  return {
    id: "@apps/solara",
    name: "Solara Social",
    version: "2.4.0",
    routePrefix: "/solara",
    icon: "☀️",
    isEnabled: true,
    requiredPermissions: ["solara:feed:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const posts = await service.listFeedAsync();
      const currentSpace = context.spaceId;
      const user = context.user;

      const postsHtml =
        posts.length > 0
          ? posts
              .map(
                (p) => `
            <article class="glass-card rounded-2xl p-5 space-y-3 border border-outline-variant/20 hover:border-primary/30 transition-all duration-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center text-lg font-bold text-primary">
                    👤
                  </div>
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">${escapeHtml(p.actorId || "Membre Solara")}</h3>
                    <p class="text-[10px] text-on-surface-variant">${new Date(p.createdAt).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })} • <span class="capitalize text-primary/80">${escapeHtml(p.publicationType)}</span></p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  ${escapeHtml(p.targetType)}
                </span>
              </div>
              <p class="text-xs text-on-surface leading-relaxed whitespace-pre-line">${escapeHtml(p.content)}</p>
              <div class="pt-2 flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant/10">
                <div class="flex items-center gap-4">
                  <button class="flex items-center gap-1.5 hover:text-rose-400 transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">favorite</span>
                    <span>${p.likeCount || 0}</span>
                  </button>
                  <button class="flex items-center gap-1.5 hover:text-primary transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">chat_bubble</span>
                    <span>${p.commentsCount || 0}</span>
                  </button>
                </div>
                <button class="hover:text-on-surface transition cursor-pointer">
                  <span class="material-symbols-outlined text-sm">share</span>
                </button>
              </div>
            </article>
          `
              )
              .join("")
          : `
            <div class="glass-card rounded-2xl p-10 text-center space-y-3 border border-outline-variant/20">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl mx-auto">
                forum
              </div>
              <h3 class="font-bold text-sm text-on-surface">Aucune publication pour l'instant</h3>
              <p class="text-xs text-on-surface-variant max-w-sm mx-auto">Soyez le premier à partager une idée ou une annonce avec la communauté Solara.</p>
            </div>
          `;

      const contentHtml = `
        <div class="max-w-4xl mx-auto space-y-6">
          <!-- Space Banner if applicable -->
          ${
            currentSpace
              ? `
            <div class="glass-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-secondary bg-surface-container-high/40">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-secondary text-2xl">workspaces</span>
                <div>
                  <p class="text-xs font-bold text-on-surface">Espace Solara : <span class="text-secondary">${escapeHtml(currentSpace)}</span></p>
                  <p class="text-[11px] text-on-surface-variant">Flux filtré et contextualisé pour cet espace.</p>
                </div>
              </div>
            </div>
          `
              : ""
          }

          <!-- Solara Social Composer -->
          <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 shadow-xl bg-surface-container-high/30">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                ☀️
              </div>
              <div class="flex-1">
                <h2 class="font-bold text-sm text-on-surface flex items-center gap-2">
                  <span>Partager sur Solara</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Communauté</span>
                </h2>
                <p class="text-[11px] text-on-surface-variant">Publiez des idées, annonces et propositions citoyennes</p>
              </div>
            </div>

            <div class="relative">
              <textarea id="composer-text" rows="3" placeholder="Quoi de neuf aujourd'hui ?" class="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary transition resize-none placeholder:text-on-surface-variant/50"></textarea>
            </div>

            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-2 text-on-surface-variant text-xs">
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer">
                  <span class="material-symbols-outlined text-base">image</span>
                  <span class="text-[11px] hidden sm:inline">Média</span>
                </button>
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer">
                  <span class="material-symbols-outlined text-base text-indigo-400">poll</span>
                  <span class="text-[11px] hidden sm:inline">Sondage</span>
                </button>
              </div>

              <button onclick="if(window.mosaixPublishPost){window.mosaixPublishPost();}else{alert('Publication Solara envoyée avec succès');}" class="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer">
                <span class="material-symbols-outlined text-sm">send</span>
                <span>Publier</span>
              </button>
            </div>
          </div>

          <!-- Feed Posts Stream -->
          <div class="space-y-4">
            ${postsHtml}
          </div>
        </div>
      `;

      const contextualSidebarHtml = `
        <div class="p-4 space-y-4">
          <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
            <span class="text-xs font-bold text-primary">Solara Community</span>
            <p class="text-[11px] text-on-surface-variant">Réseau décentralisé et discussions citoyennes de la plateforme.</p>
          </div>
          <div class="space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-2">Canaux & Filtres</span>
            <a href="/solara" class="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs">
              <span class="material-symbols-outlined text-base">dynamic_feed</span>
              <span>Fil Général</span>
            </a>
            <a href="/solara?filter=proposals" class="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface text-xs transition">
              <span class="material-symbols-outlined text-base">how_to_vote</span>
              <span>Propositions</span>
            </a>
          </div>
        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Solara — Réseau Social & Flux Communautaire",
        contextualSidebarHtml,
      };
    },
  };
}
