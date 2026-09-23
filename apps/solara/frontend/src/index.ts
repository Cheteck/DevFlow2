import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

// Register Solara contributions dynamically
shellRegistry.register({
  bacId: "solara",
  context: {
    title: "Solara Engine",
    subtitle: "Réseau & Contenu Social",
    ctaLabel: "Publier Pulse"
  },
  actions: [
    { id: "sol-feed", label: "Fil d'actualité ECHoS", icon: "rss_feed", route: "/solara", permission: "solara:read:feed" },
    { id: "sol-comm", label: "Communautés Raccordées", icon: "diversity_3", route: "/solara?view=communities", permission: "solara:read:feed" },
    { id: "sol-post", label: "Éditeur de Publication", icon: "edit_note", route: "/solara?view=compose", permission: "solara:create:post" },
    { id: "sol-mod", label: "Modération de Contenu", icon: "shield", route: "/solara/admin/moderation", permission: "solara:moderate:content", badge: "MOD", badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    { id: "sol-settings", label: "Paramètres Réseau", icon: "tune", route: "/solara?view=settings", permission: "solara:admin:settings", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

export const SolaraModerationAdminPageView = {
  id: "solara-moderation-admin-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Console de Modération Sociale ECHoS</h3>
            <p class="text-xs text-on-surface-variant">Arbitrage des publications signalées par les algorithmes de sécurité et la communauté.</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            1 Signalement en attente
          </span>
        </div>

        <div class="space-y-4">
          <div id="flagged-post-1" class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-on-surface">@spam_bot_99</span>
                <span class="text-[10px] text-on-surface-variant">• il y a 12 min</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 font-semibold">Spam suspecté</span>
              </div>
              <p class="text-xs text-on-surface/90 italic">"Gagnez 10 000 tokens en cliquant sur ce lien externe non vérifié..."</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="approveAdminPost('flagged-post-1')" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition">
                <span class="material-symbols-outlined text-xs">check</span> Conserver
              </button>
              <button onclick="deleteAdminPost('flagged-post-1')" class="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1 transition">
                <span class="material-symbols-outlined text-xs">delete</span> Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "solara-admin-moderation",
  bacId: "@apps/solara",
  title: "Modération Solara",
  description: "Arbitrage des flux sociaux ECHoS, filtrage antispam et gestion des signalements",
  icon: "share",
  route: "/solara/admin/moderation",
  category: "moderation",
  order: 20,
  badge: { text: "1 Signalement", variant: "warning" },
  metrics: [
    { id: "flagged-posts", label: "Signalements", value: 1, status: "warning", icon: "flag" },
    { id: "posts-today", label: "Pulses Publiés", value: 420, change: "+12%", status: "nominal", icon: "rss_feed" }
  ],
  render: () => SolaraModerationAdminPageView.render()
});


export const SolaraSocialFeedStyles = `
  .solara-feed-container { max-width: 100%; font-family: system-ui, -apple-system, sans-serif; color: #f3f4f6; }
  .glass-card {
    background-color: rgba(31, 41, 55, 0.4);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(75, 85, 99, 0.2);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  }
  .glass-hover-glow:hover {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    transition: all 0.3s ease;
  }
  .reaction-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 999px;
    background: #1f2937;
    border: 1px solid rgba(75, 85, 99, 0.2);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    display: flex;
    gap: 8px;
  }
  .group:hover .reaction-menu {
    opacity: 1;
    visibility: visible;
  }
`;

export const SolaraSocialFeedPageView = {
  id: "solara-feed-page",
  contractVersion: "1.0.0" as const,
  route: "/solara/feed",
  title: "Solara — ECHoS Social Feed",
  ownerApp: "@apps/solara",
  render(posts: Array<{ id: string; author: string; authorRole: string; authorAvatar: string; bacSource: string; content: string; timestamp: string; likes: number }> = []): string {
    const feedPosts = posts.length > 0 ? posts : [
      {
        id: "post-solara-1",
        author: "Solara Engine",
        authorRole: "Social BAC Core",
        authorAvatar: "☀️",
        bacSource: "solara",
        content: "Bienvenue sur le fil social unifié alimenté par l'application Solara ! Tous les flux et interactions réseau sont orchestrés ici via le protocole ECHoS.",
        timestamp: "Il y a 5 min",
        likes: 12
      },
      {
        id: "post-solara-2",
        author: "Imperia Governance",
        authorRole: "Governance BAC",
        authorAvatar: "🏛️",
        bacSource: "imperia",
        content: "Nouveau vote de gouvernance ouvert sur la plateforme. Participez à l'évolution des règles communautaires.",
        timestamp: "Il y a 25 min",
        likes: 7
      },
      {
        id: "post-solara-3",
        author: "Solidarity Hub",
        authorRole: "Mutual Aid BAC",
        authorAvatar: "🤝",
        bacSource: "solidarity",
        content: "Lancement de la campagne de soutien mutuel et de partage de ressources.",
        timestamp: "Il y a 1 heure",
        likes: 15
      }
    ];

    return `
      <style>${SolaraSocialFeedStyles}</style>
      <div class="solara-feed-container space-y-6" data-testid="solara-feed-view" style="padding: 24px; max-width: 900px; margin: 0 auto;">
        
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 2rem; font-weight: 800; color: #f9fafb; margin-bottom: 6px;">Solara Social Engine</h1>
          <p style="color: #9ca3af; font-size: 0.95rem;">Collaborative community communications network powered by the ununified ECHoS protocol.</p>
        </div>

        <!-- Composer Card -->
        <div class="glass-card rounded-2xl p-4 flex flex-col gap-3 glass-hover-glow transition-all">
          <div style="display: flex; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 9999px; background: linear-gradient(to top right, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; color: white;">
              👤
            </div>
            <textarea id="composer-text" style="background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 12px; width: 100%; color: white; outline: none; resize: none; font-size: 0.9rem; height: 80px;" placeholder="What is on your mind? Broadcast a Solara pulse..."></textarea>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(75,85,99,0.2);">
            <div style="display: flex; gap: 8px; color: #9ca3af; font-size: 0.85rem;">
              <span>⚡ Solara Pulse</span>
            </div>
            <button onclick="publishSolaraPost()" style="background: #8b5cf6; color: white; font-weight: bold; font-size: 0.85rem; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;">
              Broadcast Pulse
            </button>
          </div>
        </div>

        <!-- Feed Divider -->
        <div style="display: flex; align-items: center; gap: 12px; margin: 24px 0;">
          <div style="height: 1px; background: rgba(75,85,99,0.2); flex: 1;"></div>
          <span style="font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.1em; font-weight: bold;">Solara Feed Stream</span>
          <div style="height: 1px; background: rgba(75,85,99,0.2); flex: 1;"></div>
        </div>

        <!-- Feed Stream -->
        <div id="feed-stream" style="display: flex; flex-direction: column; gap: 16px;">
          ${feedPosts.map(post => `
            <article class="glass-card rounded-2xl p-5 flex flex-col gap-3 glass-hover-glow transition-all">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; gap: 12px; align-items: center;">
                  <div style="width: 40px; height: 40px; border-radius: 9999px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                    ${post.authorAvatar}
                  </div>
                  <div>
                    <h3 style="font-size: 0.95rem; font-weight: bold; color: #f9fafb; margin: 0;">${post.author}</h3>
                    <p style="font-size: 0.75rem; color: #9ca3af; margin: 2px 0 0 0;">${post.authorRole} • ${post.timestamp}</p>
                  </div>
                </div>
                <span style="font-size: 0.7rem; font-weight: bold; background: rgba(139,92,246,0.1); color: #a78bfa; border: 1px solid rgba(139,92,246,0.2); padding: 2px 8px; border-radius: 9999px;">${post.bacSource}</span>
              </div>
              <div style="font-size: 0.9rem; color: #d1d5db; line-height: 1.5; padding: 4px 0;">
                ${post.content}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(75,85,99,0.15);">
                <!-- Reaction Picker (Hover Trigger) -->
                <div class="relative group">
                  <button onclick="likePulse(this)" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                    <span>⚡</span> <span class="likes-count">${post.likes}</span>
                  </button>
                  
                  <!-- Floating Menu -->
                  <div class="reaction-menu">
                    <button onclick="addReaction('like')" class="hover:scale-125 transition-transform">⚡</button>
                    <button onclick="addReaction('love')" class="hover:scale-125 transition-transform">❤️</button>
                    <button onclick="addReaction('laugh')" class="hover:scale-125 transition-transform">😂</button>
                    <button onclick="addReaction('surprised')" class="hover:scale-125 transition-transform">😲</button>
                    <button onclick="addReaction('sad')" class="hover:scale-125 transition-transform">😢</button>
                    <button onclick="addReaction('angry')" class="hover:scale-125 transition-transform">😡</button>
                  </div>
                </div>

                <span style="font-size: 0.75rem; color: #6b7280;">Propelled by Solara</span>
              </div>
            </article>
          `).join("")}
        </div>

      </div>

      <script>
        function likePulse(btn) {
          const countEl = btn.querySelector('.likes-count');
          countEl.textContent = parseInt(countEl.textContent) + 1;
        }

        function addReaction(type) {
          console.log('Reaction added:', type);
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-4 right-4 bg-purple-900/90 text-white px-4 py-2 rounded-xl border border-purple-500/30 shadow-lg text-sm z-50 backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100';
          toast.textContent = 'Réaction "' + type + '" enregistrée !';
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
          }, 2000);
          if (typeof window.fetch === 'function') {
            fetch('/api/solara/reactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, timestamp: Date.now() })
            }).catch(() => {});
          }
        }

        function publishSolaraPost() {
          const txtArea = document.getElementById('composer-text');
          const content = txtArea.value.trim();
          if (!content) return;

          const stream = document.getElementById('feed-stream');
          const article = document.createElement('article');
          article.className = 'glass-card rounded-2xl p-5 flex flex-col gap-3 glass-hover-glow transition-all';
          article.style.marginBottom = '16px';

          article.innerHTML = \`
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="display: flex; gap: 12px; align-items: center;">
                <div style="width: 40px; height: 40px; border-radius: 9999px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                  👤
                </div>
                <div>
                  <h3 style="font-size: 0.95rem; font-weight: bold; color: #f9fafb; margin: 0;">Anonymous User</h3>
                  <p style="font-size: 0.75rem; color: #9ca3af; margin: 2px 0 0 0;">Platform Member • Just now</p>
                </div>
              </div>
              <span style="font-size: 0.7rem; font-weight: bold; background: rgba(139,92,246,0.1); color: #a78bfa; border: 1px solid rgba(139,92,246,0.2); padding: 2px 8px; border-radius: 9999px;">solara</span>
            </div>
            <div class="post-body" style="font-size: 0.9rem; color: #d1d5db; line-height: 1.5; padding: 4px 0;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(75,85,99,0.15);">
              <button onclick="likePulse(this)" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span> <span class="likes-count">0</span> likes
              </button>
              <span style="font-size: 0.75rem; color: #6b7280;">Propelled by Solara</span>
            </div>
          \`;
          article.querySelector('.post-body').textContent = content;

          stream.insertBefore(article, stream.firstChild);
          txtArea.value = '';
        }
      </script>
    `;
  },
};

export const solaraNavigationItems = [
  { id: "nav-feed", label: "Social Feed", route: "/solara/feed", pageView: SolaraSocialFeedPageView },
];

export function registerSolaraAdminPages() {
  return [
    {
      applicationId: "@apps/solara",
      pageId: "social-moderation",
      pageTitle: "Social Moderation",
      description: "Modération des publications Solara",
      routePath: "/solara/admin/moderation",
      entrypoint: "social-moderation",
      order: 20,
      permission: "solara:moderate:content"
    }
  ];
}

export const solaraContributions: ContributionContract[] = [
  {
    id: "solara:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solara",
    kind: "navigation",
    title: "Solara Feed",
    route: "/solara/feed",
    icon: "☀️",
    placements: [{ id: "p-solara-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 40 }],
  },
  {
    id: "solara:feed-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solara",
    kind: "page",
    title: "Solara — ECHoS Social Feed",
    route: "/solara/feed",
    placements: [{ id: "p-solara-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: SolaraSocialFeedPageView.render() },
  },
];
