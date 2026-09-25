/**
 * @apps/solara — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Solara Social & Content (inspired by Facebook).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { SolaraSocialService } from "../domain/social.model.js";
import {
  ForYouRecommendationEngine,
  TrendingVelocityRanker,
  SponsoredPostInjector,
  ContentSafetyFilter,
  isSponsoredPost
} from "@mosaix/feed-engine";

export function createSolaraDescriptor(socialService?: SolaraSocialService): BacDescriptor {
  const service = socialService || new SolaraSocialService();

  const FRIENDS = [
    { name: "Amel", role: "Designer", avatar: "💎" },
    { name: "Ali", role: "Dev", avatar: "💻" },
    { name: "Sarah", role: "Support", avatar: "👤" },
    { name: "Sofiane", role: "Citizen", avatar: "🚴" },
    { name: "Yasmine", role: "Educator", avatar: "🎨" },
    { name: "Karim", role: "Manager", avatar: "📊" }
  ];

  return {
    id: "@apps/solara",
    name: "Solara Social",
    version: "2.5.0",
    routePrefix: "/solara",
    icon: "☀️",
    isEnabled: true,
    requiredPermissions: ["solara:feed:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = context.request.query.view || "feed";
      const currentSpace = context.spaceId;
      const user = context.user;

      let subViewHtml: string;

      if (view === "profile") {
        // --- HIGH FIDELITY FACEBOOK-STYLE PROFILE VIEW ---
        const userPosts = (await service.listFeedAsync()).filter(p => p.actorId === user.id || p.actorId === "Lord Cheteck" || !p.actorId);
        
        const userPostsHtml = userPosts.length > 0 ? userPosts.map(p => `
          <article class="glass-card rounded-2xl p-5 space-y-3 border border-outline-variant/20 hover:border-primary/30 transition-all duration-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <img src="/src/assets/images/solara_user_avatar_1790307586946.jpg" alt="Avatar" class="w-10 h-10 rounded-xl object-cover border border-outline-variant/15" />
                <div>
                  <h3 class="text-xs font-bold text-on-surface">${escapeHtml(user.id || "Lord Cheteck")}</h3>
                  <p class="text-[10px] text-on-surface-variant">
                    <span>${new Date(p.createdAt).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span aria-hidden="true" class="text-outline-variant/40"> · </span>
                    <span class="capitalize text-primary/80">${escapeHtml(p.publicationType)}</span>
                  </p>
                </div>
              </div>
            </div>
            <p class="text-xs text-on-surface leading-relaxed whitespace-pre-line">${escapeHtml(p.content)}</p>
            <div class="pt-2 flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant/10">
              <div class="flex items-center gap-4">
                <button onclick="const count = this.querySelector('.like-count'); count.textContent = String(parseInt(count.textContent) + 1); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Publication aimee !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="flex items-center gap-1.5 hover:text-rose-400 transition cursor-pointer">
                  <span class="material-symbols-outlined text-sm">favorite</span>
                  <span class="like-count font-mono tabular-nums">${p.likeCount || 0}</span>
                </button>
                <button class="flex items-center gap-1.5 hover:text-primary transition cursor-pointer">
                  <span class="material-symbols-outlined text-sm">chat_bubble</span>
                  <span class="font-mono tabular-nums">${p.commentsCount || 0}</span>
                </button>
              </div>
            </div>
          </article>
        `).join("") : `
          <div class="glass-card rounded-2xl p-8 text-center text-xs text-on-surface-variant border border-outline-variant/20">
            Aucune publication sur votre journal pour le moment.
          </div>
        `;

        subViewHtml = `
          <div class="space-y-6">
            <!-- Profile Header Section -->
            <div class="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-surface-container-low/40 relative">
              <!-- Cover Image -->
              <div class="h-48 md:h-64 relative overflow-hidden">
                <img src="/src/assets/images/solara_profile_cover_1790307575935.jpg" alt="Photo de couverture" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </div>

              <!-- Profile Info superposed -->
              <div class="p-6 pt-0 flex flex-col md:flex-row items-center md:items-end justify-between -mt-16 md:-mt-20 relative z-10 gap-4">
                <div class="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                  <div class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-surface bg-surface shadow-xl shrink-0">
                    <img src="/src/assets/images/solara_user_avatar_1790307586946.jpg" alt="Avatar de profil" class="w-full h-full object-cover" />
                  </div>
                  <div class="space-y-1 pb-2">
                    <h2 class="text-xl font-bold text-on-surface flex items-center justify-center md:justify-start gap-2">
                      <span>${escapeHtml(user.id || "Lord Cheteck")}</span>
                      <span class="material-symbols-outlined text-sm text-primary" title="Compte vérifié">verified</span>
                    </h2>
                    <p class="text-xs text-on-surface-variant font-normal">Gouverneur de la Plateforme & Architecte Logiciel · Jijel, Algérie</p>
                    <div class="flex items-center gap-1.5 justify-center md:justify-start text-[10px] text-on-surface-variant/80 font-mono tabular-nums mt-1">
                      <span><strong>18</strong> relations</span>
                      <span aria-hidden="true" class="text-outline-variant/40">·</span>
                      <span><strong>142</strong> abonnés</span>
                    </div>
                  </div>
                </div>

                <!-- Profile CTA actions -->
                <div class="flex items-center gap-2 pb-2">
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Story creee avec succes !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold transition hover:opacity-95 shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-sm">add_circle</span>
                    <span>Ajouter à la story</span>
                  </button>
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Formulaire de modification ouvert'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-bold text-on-surface transition cursor-pointer flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">edit</span>
                    <span>Modifier</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Profile Body Columns -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Left Sidebar: Intro & Relations -->
              <div class="lg:col-span-4 space-y-6">
                <!-- Intro Box -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Intro</h3>
                  <p class="text-xs text-on-surface-variant leading-relaxed text-center italic">"Bâtir le futur décentralisé de MosaiX à l'aide de l'architecture hexagonale et du design d'élite."</p>
                  
                  <div class="space-y-2.5 pt-2 text-xs">
                    <div class="flex items-center gap-2.5 text-on-surface-variant">
                      <span class="material-symbols-outlined text-base text-primary/80">work</span>
                      <span>Architecte principal chez <strong>MosaiX Core</strong></span>
                    </div>
                    <div class="flex items-center gap-2.5 text-on-surface-variant">
                      <span class="material-symbols-outlined text-base text-primary/80">home</span>
                      <span>Habite à <strong>Jijel, Algérie</strong></span>
                    </div>
                    <div class="flex items-center gap-2.5 text-on-surface-variant">
                      <span class="material-symbols-outlined text-base text-primary/80">link</span>
                      <a href="https://mosaix.io" target="_blank" class="text-primary hover:underline font-semibold">mosaix.io/cheteck</a>
                    </div>
                  </div>
                </div>

                <!-- Friends/Relations Box -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                  <div class="flex justify-between items-center">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Relations</h3>
                    <span class="text-[10px] text-primary font-bold font-mono tabular-nums">6 actives</span>
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    ${FRIENDS.map(f => `
                      <div class="text-center group cursor-pointer">
                        <div class="aspect-square rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 flex items-center justify-center text-xl shadow-sm transition group-hover:scale-105">
                          ${f.avatar}
                        </div>
                        <span class="text-[9px] font-bold text-on-surface block mt-1 truncate">${escapeHtml(f.name)}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>

              <!-- Right: Timeline composer & user posts -->
              <div class="lg:col-span-8 space-y-6">
                <!-- Composer for Profile Wall -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                  <div class="flex items-center gap-3">
                    <img src="/src/assets/images/solara_user_avatar_1790307586946.jpg" alt="Avatar" class="w-10 h-10 rounded-xl object-cover border border-outline-variant/15" />
                    <input type="text" id="profile-wall-composer" placeholder="Écrire quelque chose sur votre journal..." class="flex-1 bg-surface-container-low/60 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
                  </div>
                  <div class="flex justify-end pt-1">
                    <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Publication ajoutee au journal'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                      <span class="material-symbols-outlined text-sm">send</span>
                      <span>Publier sur mon journal</span>
                    </button>
                  </div>
                </div>

                <!-- User Posts Stream -->
                <div class="space-y-4">
                  ${userPostsHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // --- STANDARD SOLARA SOCIAL NEWS FEED VIEW ---
        const feedMode = context.request.query.mode || "for_you";
        let rawPosts = await service.listFeedAsync();

        // 1. Safety Filter (Auto-spam and toxic content elimination)
        rawPosts = ContentSafetyFilter.filterUnsafe(rawPosts);

        // 2. Algorithm Dispatcher
        let rankedPosts: typeof rawPosts;
        if (feedMode === "trending") {
          rankedPosts = TrendingVelocityRanker.rankByTrending(rawPosts);
        } else if (feedMode === "media") {
          rankedPosts = rawPosts.filter(p => p.mediaUrls && p.mediaUrls.length > 0);
        } else if (feedMode === "chronological") {
          rankedPosts = [...rawPosts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else {
          // Default: "for_you" personalized AI recommendation
          rankedPosts = ForYouRecommendationEngine.generateForYouFeed(rawPosts, {
            userId: user.id || "Lord Cheteck",
            followedSpaceIds: ["space-commerce", "space-events"],
            interestTags: ["artisanat", "booking", "musique", "tech"]
          });
        }

        // 3. Native Non-Intrusive Sponsored Insertion
        const displayPosts = SponsoredPostInjector.inject(rankedPosts, service.getSponsoredPool(), {
          interval: 3,
          maxSponsoredPosts: 2
        });

        const postsHtml = displayPosts.length > 0 ? displayPosts.map(p => {
          const isSponsored = isSponsoredPost(p);

          if (isSponsored) {
            return `
              <article class="glass-card rounded-2xl p-5 space-y-4 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-surface-container-high/30 to-purple-500/5 shadow-lg relative overflow-hidden transition-all duration-200 hover:border-amber-500/50">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-amber-500/20">
                      ⚡
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <h3 class="text-xs font-bold text-on-surface">${escapeHtml(p.sponsorName || "Sponsor MosaiX")}</h3>
                        <span class="material-symbols-outlined text-[13px] text-amber-400" title="Partenaire certifié">verified</span>
                      </div>
                      <p class="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                        <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] uppercase tracking-wider">${escapeHtml(p.sponsorBadge || "Sponsorisé")}</span>
                        <span>· Campagne ${escapeHtml(p.campaignId)}</span>
                      </p>
                    </div>
                  </div>
                  <button onclick="fetch('/api/solara/telemetry/ad', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({campaignId:'${p.campaignId}', postId:'${p.id}', eventType:'click'})}); const t=document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-lg z-50'; t.textContent='Annonce transparente certifiee par le protocole MosaiX'; document.body.appendChild(t); setTimeout(()=>t.remove(),2500);" class="text-[10px] text-on-surface-variant hover:text-amber-400 transition flex items-center gap-1 cursor-pointer">
                    <span class="material-symbols-outlined text-xs">info</span>
                    <span>Transparence</span>
                  </button>
                </div>

                <p class="text-xs text-on-surface leading-relaxed whitespace-pre-line font-medium">${escapeHtml(p.content)}</p>

                ${p.mediaUrls && p.mediaUrls.length > 0 ? `
                  <div class="rounded-xl overflow-hidden border border-outline-variant/20 shadow-md">
                    <img src="${escapeHtml(p.mediaUrls[0])}" alt="Média sponsorisé" class="w-full h-48 md:h-56 object-cover hover:scale-[1.01] transition-transform duration-300" />
                  </div>
                ` : ""}

                <div class="pt-2 flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant/10">
                  <div class="flex items-center gap-3">
                    <button onclick="const count = this.querySelector('.like-count'); count.textContent = String(parseInt(count.textContent) + 1);" class="flex items-center gap-1.5 hover:text-rose-400 transition cursor-pointer">
                      <span class="material-symbols-outlined text-sm">favorite</span>
                      <span class="like-count font-mono tabular-nums">${p.likeCount || 0}</span>
                    </button>
                    <button class="flex items-center gap-1.5 hover:text-primary transition cursor-pointer">
                      <span class="material-symbols-outlined text-sm">chat_bubble</span>
                      <span class="font-mono tabular-nums">${p.commentsCount || 0}</span>
                    </button>
                  </div>

                  ${p.ctaText ? `
                    <a href="${escapeHtml(p.ctaUrl || '#')}" onclick="fetch('/api/solara/telemetry/ad', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({campaignId:'${p.campaignId}', postId:'${p.id}', eventType:'cta_conversion'})});" class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
                      <span>${escapeHtml(p.ctaText)}</span>
                      <span class="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  ` : ""}
                </div>
              </article>
            `;
          }

          return `
            <article class="glass-card rounded-2xl p-5 space-y-3 border border-outline-variant/20 hover:border-primary/30 transition-all duration-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center text-lg font-bold text-primary">
                    👤
                  </div>
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">${escapeHtml(p.actorId || "Membre Solara")}</h3>
                    <p class="text-[10px] text-on-surface-variant">
                      <span>${new Date(p.createdAt).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span aria-hidden="true" class="text-outline-variant/40"> · </span>
                      <span class="capitalize text-primary/80">${escapeHtml(p.publicationType)}</span>
                    </p>
                  </div>
                </div>
                <div class="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  ${escapeHtml(p.targetType)}
                </div>
              </div>

              <p class="text-xs text-on-surface leading-relaxed whitespace-pre-line">${escapeHtml(p.content)}</p>

              ${p.mediaUrls && p.mediaUrls.length > 0 ? `
                <div class="rounded-xl overflow-hidden border border-outline-variant/20 shadow-md">
                  <img src="${escapeHtml(p.mediaUrls[0])}" alt="Média publication" class="w-full h-48 md:h-56 object-cover" />
                </div>
              ` : ""}

              <div class="pt-2 flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant/10">
                <div class="flex items-center gap-3">
                  <button onclick="const count = this.querySelector('.like-count'); count.textContent = String(parseInt(count.textContent) + 1); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Publication aimée !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="flex items-center gap-1.5 hover:text-rose-400 transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">favorite</span>
                    <span class="like-count font-mono tabular-nums">${p.likeCount || 0}</span>
                  </button>
                  <button onclick="const count = this.querySelector('.fire-count'); count.textContent = String(parseInt(count.textContent) + 1);" class="flex items-center gap-1.5 hover:text-amber-400 transition cursor-pointer" title="Inspiration">
                    <span class="text-xs">💡</span>
                    <span class="fire-count font-mono tabular-nums">3</span>
                  </button>
                  <button class="flex items-center gap-1.5 hover:text-primary transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">chat_bubble</span>
                    <span class="font-mono tabular-nums">${p.commentsCount || 0}</span>
                  </button>
                </div>
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-primary text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Lien copié dans le presse-papier !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="hover:text-on-surface transition cursor-pointer" title="Partager">
                  <span class="material-symbols-outlined text-sm">share</span>
                </button>
              </div>
            </article>
          `;
        }).join("") : `
          <div class="glass-card rounded-2xl p-10 text-center space-y-3 border border-outline-variant/20">
            <h3 class="font-bold text-sm text-on-surface">Aucune publication dans ce flux</h3>
            <p class="text-xs text-on-surface-variant max-w-sm mx-auto">Changez d'onglet d'algorithme ou soyez le premier à publier.</p>
          </div>
        `;

        subViewHtml = `
          <div class="space-y-6">
            <!-- Space Banner if applicable -->
            ${currentSpace ? `
              <div class="glass-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-secondary bg-surface-container-high/40">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary text-2xl">workspaces</span>
                  <div>
                    <p class="text-xs font-bold text-on-surface">Espace Solara : <span class="text-secondary">${escapeHtml(currentSpace)}</span></p>
                    <p class="text-[11px] text-on-surface-variant">Flux filtré et contextualisé pour cet espace.</p>
                  </div>
                </div>
              </div>
            ` : ""}

            <!-- Feed Algorithm Selector (Bluesky / Phoenix Style) -->
            <div class="flex items-center gap-2 p-1.5 rounded-2xl bg-surface-container-low/70 border border-outline-variant/20 overflow-x-auto">
              <a href="/solara?view=feed&mode=for_you" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${feedMode === 'for_you' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">
                <span class="text-sm">✨</span>
                <span>Pour Toi</span>
              </a>
              <a href="/solara?view=feed&mode=trending" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${feedMode === 'trending' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">
                <span class="text-sm">🔥</span>
                <span>Tendances</span>
              </a>
              <a href="/solara?view=feed&mode=chronological" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${feedMode === 'chronological' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">
                <span class="text-sm">⏱️</span>
                <span>Chronologique</span>
              </a>
              <a href="/solara?view=feed&mode=media" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${feedMode === 'media' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">
                <span class="text-sm">🖼️</span>
                <span>Médias</span>
              </a>
            </div>

            <!-- Solara Social News Feed Composer -->
            <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 shadow-xl bg-surface-container-high/30">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                  ☀️
                </div>
                <div class="flex-1">
                  <h2 class="font-bold text-sm text-on-surface flex items-center gap-1.5">
                    <span>Partager sur Solara</span>
                    <span class="text-[10px] text-primary/80 font-medium">· Communauté</span>
                  </h2>
                  <p class="text-[11px] text-on-surface-variant">Exprimez-vous et échangez avec vos proches</p>
                </div>
              </div>

              <div class="relative">
                <textarea id="composer-text" rows="3" placeholder="Quoi de neuf aujourd'hui, ${escapeHtml(user.id || 'Lord Cheteck')} ?" class="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary transition resize-none placeholder:text-on-surface-variant/50"></textarea>
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

                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Publication Solara envoyée avec succès'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer">
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
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Solara Navigation header -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">☀️</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Solara</h1>
                <p class="text-[11px] text-on-surface-variant">Le réseau social de MosaiX</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/solara?view=feed" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'feed' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">dynamic_feed</span>
                <span>Fil d'actualité</span>
              </a>
              <a href="/solara?view=profile" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'profile' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">person</span>
                <span>Mon Profil</span>
              </a>
            </div>
          </div>

          <!-- Active View Render -->
          ${subViewHtml}

        </div>
      `;

      const contextualSidebarHtml = `
        <div class="p-4 space-y-4">
          <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
            <span class="text-xs font-bold text-primary">Solara Community</span>
            <p class="text-[11px] text-on-surface-variant">Réseau décentralisé et discussions de la plateforme.</p>
          </div>
          <div class="space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-2 font-mono">Navigation</span>
            <a href="/solara?view=feed" class="flex items-center gap-2 px-3 py-2 rounded-xl ${view === 'feed' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface'} text-xs transition">
              <span class="material-symbols-outlined text-base">dynamic_feed</span>
              <span>Fil d'actualité</span>
            </a>
            <a href="/solara?view=profile" class="flex items-center gap-2 px-3 py-2 rounded-xl ${view === 'profile' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface'} text-xs transition">
              <span class="material-symbols-outlined text-base">person</span>
              <span>Mon Profil</span>
            </a>
          </div>
        </div>
      `;

      return {
        contentHtml,
        pageTitle: `Solara — ${view === 'profile' ? 'Mon Profil' : 'Réseau Social'}`,
        contextualSidebarHtml,
      };
    },
  };
}
