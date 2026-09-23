import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const BeamAdminPageView = {
  id: "beam-admin-channels-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Administration des Canaux & Flux Beam</h3>
            <p class="text-xs text-on-surface-variant">Gestion des salons de diffusion officiels et passerelles webhooks en temps réel.</p>
          </div>
          <button onclick="createAdminBeamChannel()" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-sm">add</span> Créer un Canal
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-3">
            <h4 class="font-bold text-xs text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-purple-400">campaign</span>
              Déclarer un Canal Officiel
            </h4>
            <div class="space-y-2">
              <input type="text" id="admin-beam-channel" placeholder="#annonces-officielles" class="w-full px-3 py-1.5 text-xs rounded-lg bg-surface-variant/40 border border-outline-variant/20 text-on-surface outline-none focus:border-primary">
              <input type="text" id="admin-beam-desc" placeholder="Description du canal de diffusion" class="w-full px-3 py-1.5 text-xs rounded-lg bg-surface-variant/40 border border-outline-variant/20 text-on-surface outline-none focus:border-primary">
              <button onclick="createAdminBeamChannel()" class="w-full py-1.5 rounded-lg bg-surface-variant/40 hover:bg-surface-variant/60 text-xs font-semibold text-primary transition">
                Enregistrer le canal
              </button>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-3">
            <h4 class="font-bold text-xs text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-emerald-400">hub</span>
              Passerelles Webhooks Connectées
            </h4>
            <div class="space-y-2 text-xs">
              <div class="p-2.5 rounded-lg bg-surface-variant/20 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <span class="font-mono font-semibold text-purple-300">/api/webhooks/solara-sync</span>
                  <p class="text-[10px] text-on-surface-variant">Événements cross-BAC instantanés</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">ACTIF</span>
              </div>
              <div class="p-2.5 rounded-lg bg-surface-variant/20 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <span class="font-mono font-semibold text-purple-300">/api/webhooks/citadelle-auth</span>
                  <p class="text-[10px] text-on-surface-variant">Notifications de session SSO</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">ACTIF</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "beam-admin-channels",
  bacId: "@apps/beam",
  title: "Canaux & Webhooks",
  description: "Gestion des canaux de diffusion officiels et passerelles webhooks en temps réel",
  icon: "chat",
  route: "/beam/admin/channels",
  category: "collaboration",
  order: 50,
  badge: { text: "3 Canaux", variant: "neutral" },
  metrics: [
    { id: "active-channels", label: "Canaux Ouverts", value: 3, status: "nominal", icon: "forum" },
    { id: "messages-sec", label: "Débit Messages", value: "48/s", status: "nominal", icon: "speed" }
  ],
  render: () => BeamAdminPageView.render()
});

export const BeamConversationPageView = {
  id: "beam-chat-page",
  contractVersion: "1.0.0" as const,
  route: "/beam/chat",
  title: "Beam — Messenger",
  ownerApp: "@apps/beam",
  render(): string {
    return `
      <div class="flex flex-col w-full h-[calc(100vh-4rem)] overflow-hidden font-sans" data-testid="beam-messenger-view">
        <div class="flex flex-1 w-full h-full min-h-0 bg-surface text-on-surface overflow-hidden">
          
          <!-- LEFT COLUMN: CONVERSATIONS & CHATS LIST -->
          <aside class="w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant/15 relative z-20">
            
            <!-- List Header & Filter Tabs -->
            <div class="p-4 pb-2 flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-bold tracking-tight text-on-surface">Discussions</h1>
                  <span class="text-xs font-bold text-outline">3 non lues</span>
                </div>
                <div class="flex items-center gap-1">
                  <button onclick="promptNewConversation()" class="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-all duration-200 cursor-pointer" title="Nouvelle discussion">
                    <span class="material-symbols-outlined text-[20px]">edit_square</span>
                  </button>
                  <button onclick="switchAdminTab('beam-admin-channels')" class="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-all duration-200 cursor-pointer" title="Options / Administration">
                    <span class="material-symbols-outlined text-[20px]">tune</span>
                  </button>
                </div>
              </div>

              <!-- Search Bar -->
              <div class="relative w-full">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[20px]">search</span>
                <input id="beam-search-conversations" oninput="filterBeamConversations(this.value)" class="w-full pl-10 pr-4 py-2 rounded-full bg-surface-container text-on-surface placeholder:text-outline text-xs focus:outline-none focus:bg-surface-container-high transition-colors" placeholder="Rechercher dans Messenger..." type="text"/>
              </div>

              <!-- Filter Chips -->
              <div class="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs font-medium">
                <button onclick="setBeamFilter('all', this)" class="beam-filter-btn px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-semibold transition-all cursor-pointer">Tous</button>
                <button onclick="setBeamFilter('unread', this)" class="beam-filter-btn px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer">Non lus</button>
                <button onclick="setBeamFilter('groups', this)" class="beam-filter-btn px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer">Groupes</button>
                <button onclick="setBeamFilter('spaces', this)" class="beam-filter-btn px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer">Spaces</button>
              </div>
            </div>

            <!-- Online Active Contacts Stories Reel -->
            <div class="px-4 py-2 border-b border-outline-variant/10">
              <div class="flex items-center gap-4 overflow-x-auto pb-1 no-scrollbar">
                
                <!-- Create story / Add -->
                <div class="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group">
                  <div class="relative w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-primary-container transition-colors">
                    <span class="material-symbols-outlined text-primary group-hover:text-on-primary-container text-[22px]">add</span>
                  </div>
                  <span class="text-[11px] text-outline truncate max-w-[56px] text-center">Votre note</span>
                </div>

                <!-- Contact Elena -->
                <div onclick="selectBeamContact('Elena Rodriguez', 'elena', true)" class="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group">
                  <div class="relative">
                    <img class="w-12 h-12 rounded-full object-cover p-[2px] bg-gradient-to-tr from-primary to-secondary-container" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSHf9wDZGIKeLZKvzxvbQViy0Ju3r-lUGqLP7pMHhAx6-IpVFxcS1Nt7xuLUrflrfS8EfkwspQFNzX98NTtgHlbyT1FHQSDZ0YZXf-__SW6ZwS9bS2kYAGZu0xIlrJ2rzbSDgambM1CLuQllAHhdpaGnhheYwhVlW3NytV8-671g4U05zL8a9Y-e_o3xtdIjcOgszCzKR_eSNrAZQhrJzseBAJVMuELS_OC4B_qdvJooIql6DTUQg"/>
                    <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                  </div>
                  <span class="text-[11px] text-on-surface truncate max-w-[56px] text-center font-medium">Elena</span>
                </div>

                <!-- Contact Marcus -->
                <div onclick="selectBeamContact('Marcus Chen', 'marcus', true)" class="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group">
                  <div class="relative">
                    <img class="w-12 h-12 rounded-full object-cover p-[2px] bg-surface-container-highest" alt="Marcus Chen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAv2SDyE3JbPjzzHoDct616EJdimpIIz6lXrXibY5F-YkFqP0O6ZdrI2ZiDFV2hGP041o6-Q0L5lmnvF9w1-6GqTpCCUzo3rjtUwzbi24F3vcKXj9Fbk4MWi6yKrSC2eC9ZkHb-PZK8sOs1kT8Z8UwEW-lRf7Wr1YJwq2uY9TMYoA6wmNIbSbYeWHI-T4X7jDwCWqooZXcz301xqFADQCEGGNmjOuyp3Wt_Li1tFWi2VsyyfGNVqjA"/>
                    <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant truncate max-w-[56px] text-center">Marcus</span>
                </div>

                <!-- Contact Sarah -->
                <div onclick="selectBeamContact('Sarah K.', 'sarah', true)" class="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group">
                  <div class="relative">
                    <img class="w-12 h-12 rounded-full object-cover p-[2px] bg-surface-container-highest" alt="Sarah K." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL5Ef8VBgosZi6IT_5IIa9b8NYqb-vqLbR3ghGiV6w8L1wq89oiBFG-LcLZ9bFtm6EfpbhS2adSD5as0UeKstZ0y1R5ZexTM8JO5jcfyO4288rz51yajE3FV6mS1HIiFrGsQgb8ulMKh5BZdOnU6kAaTgR5yaQf4_eE9DdFVxoSltMsIh5r4fD1qaz132WgU1njSAxksc2sMw8-QifDYZ5sVGbiKuPpP071ll9-ILGZl4tDaZ_qZY"/>
                    <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant truncate max-w-[56px] text-center">Sarah</span>
                </div>

                <!-- Contact Liam -->
                <div onclick="selectBeamContact('Liam Frost', 'liam', true)" class="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group">
                  <div class="relative">
                    <img class="w-12 h-12 rounded-full object-cover p-[2px] bg-surface-container-highest" alt="Liam Frost" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAS7VXG3PAYFi3YGAKItfw-qpMcaJ4T-TPV_zsRzHpmTweDwamSh83cQmsi4Zt_dz2n6dK1lUTY4d7NDGfPsKOJq0WXwCzp8F2aDT1gZGGyYB0dLE6lgb6lNMVmqT6VBTNcByPRj9L44WQJpnpPbVoELTq9MbhB8kWKCJaKm-jOoL36_LMu1i-pTfvKqefj-2f-w8Hsj0-9_DG46QxTnEfh510OhXlajuMPtlaFYgTIWGEyTfkbKNY"/>
                    <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant truncate max-w-[56px] text-center">Liam</span>
                </div>

              </div>
            </div>

            <!-- Conversations Scrollable Feed -->
            <div class="flex-1 overflow-y-auto px-2 py-2 space-y-1" id="beam-conversation-list">
              
              <!-- Active item: Elena Rodriguez -->
              <div onclick="selectBeamContact('Elena Rodriguez', 'elena', true)" data-type="direct" data-unread="false" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-high/60 cursor-pointer relative shadow-sm border border-primary/20">
                <div class="relative flex-shrink-0">
                  <img class="w-12 h-12 rounded-full object-cover" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJd9SZoL-Q4DWbHajCgxUz2QePo4B_fdNHNHhDBf5cQm79wJ_8snKcayqdXxnLOkGpXqflh2AYHgxFWh3U_1hsvvPcypvj8EA3dykdm703CXeJ9KWIfykIKI3SmBI5gmMDglhl-xTuaAqjHcHoGv1B4i3uufKNRE7QlBomN--BqpH3ksE2OeguU3rojNL_yh6GHqbSSUGIgg1a7blZOTjFXPwoD1KBKVU-koH51V7_ltvFvIgbjnc"/>
                  <span class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="text-xs font-bold text-on-surface truncate">Elena Rodriguez</span>
                      <span class="material-symbols-outlined text-[16px] text-primary" style="font-variation-settings: 'FILL' 1;">verified</span>
                    </div>
                    <span class="text-[11px] text-primary font-medium">14:28</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface truncate">Le nouveau prototype UI est prêt sur Figma !</p>
                    <span class="material-symbols-outlined text-[16px] text-primary ml-1 flex-shrink-0" style="font-variation-settings: 'FILL' 1;">done_all</span>
                  </div>
                </div>
              </div>

              <!-- Conversation: Marcus Chen (Unread) -->
              <div onclick="selectBeamContact('Marcus Chen', 'marcus', true)" data-type="direct" data-unread="true" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors">
                <div class="relative flex-shrink-0">
                  <img class="w-12 h-12 rounded-full object-cover" alt="Marcus Chen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7tSxNCOKexMw0ErmBgfRe68WiIlZloSvCgcfl73snNAxEn1SyXmCiVIrYlcbeeA8Wc-V7TFty7Ty7Gc3u1Jm5ddAfZ8W50wLtQ4vSgR18N6QUnT1--EInoeGI9SR7xbtgapuvj-6LTOVAS2cEo8GwEyuZykOsTAuRulKAaRmRbuddhroTaq8vefzjBB2fTeqGzpo_SOGomsuqKAy8QpeIHk1KEgIKccNxhcubiSLkArt867frC08"/>
                  <span class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-on-surface truncate">Marcus Chen</span>
                    <span class="text-[11px] text-primary-fixed font-bold">12:15</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface font-semibold truncate">Superbe rendu néon ! On valide ?</p>
                    <span class="w-4 h-4 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold flex items-center justify-center flex-shrink-0 ml-1">2</span>
                  </div>
                </div>
              </div>

              <!-- Conversation: Group UI/UX Designers Club -->
              <div onclick="selectBeamContact('UI/UX Designers Club', 'group', false)" data-type="groups" data-unread="false" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors">
                <div class="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-secondary-container/70 flex items-center justify-center">
                  <span class="material-symbols-outlined text-secondary text-[24px]">diversity_3</span>
                  <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-on-primary-container text-[11px]">group</span>
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-on-surface truncate">UI/UX Designers Club</span>
                    <span class="text-[11px] text-outline">Hier</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface-variant truncate"><span class="text-on-surface font-medium">Julian:</span> Quelqu'un a testé la palette ?</p>
                  </div>
                </div>
              </div>

              <!-- Conversation: Pulse Marketplace Support -->
              <div onclick="selectBeamContact('Pulse Support', 'support', false)" data-type="spaces" data-unread="false" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors">
                <div class="relative flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <span class="material-symbols-outlined text-[24px]">local_mall</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="text-xs font-bold text-on-surface truncate">Pulse Support</span>
                      <span class="material-symbols-outlined text-[15px] text-tertiary">check_circle</span>
                    </div>
                    <span class="text-[11px] text-outline">Mar</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface-variant truncate">Votre commande #MP-982 est expédiée</p>
                  </div>
                </div>
              </div>

              <!-- Conversation: Liam Frost -->
              <div onclick="selectBeamContact('Liam Frost', 'liam', true)" data-type="direct" data-unread="false" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors">
                <div class="relative flex-shrink-0">
                  <img class="w-12 h-12 rounded-full object-cover" alt="Liam Frost" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC32jAnFq-C-kNH85AcDN_WeQgwBzjTvCjnWP6VKr2GFw7I0_Im-rFo55HiJwBMX7D01tDEk0JpNqRgsjSfEhSUwgrRGkmwtKeQXPuQIARUy3TNyCkXkS7uPFkCcGLxOOP9-rnBUckDkHLrW3dgJc4Tmd5gfBmb9R-4SQ7EogxJYhekklByJjnnHrWxg2dd_NyyYel7BJwCLcJun_XVrUvVUtQTaMvyKedfpxpuvWZCxT1zIDtmbdQ"/>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-on-surface truncate">Liam Frost</span>
                    <span class="text-[11px] text-outline">Lun</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface-variant truncate">Je t'ai envoyé les assets 3D en WebGL</p>
                  </div>
                </div>
              </div>

              <!-- Conversation: Sophie & David (Design Sprint) -->
              <div onclick="selectBeamContact('Sprint Review #4', 'sprint', false)" data-type="spaces" data-unread="false" class="conv-item flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors">
                <div class="relative flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                  <span class="material-symbols-outlined text-[24px]">rocket_launch</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-on-surface truncate">Sprint Review #4</span>
                    <span class="text-[11px] text-outline">03 Mai</span>
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    <p class="text-xs text-on-surface-variant truncate">David a épinglé une nouvelle note de mise à jour</p>
                  </div>
                </div>
              </div>

            </div>
          </aside>

          <!-- CENTER COLUMN: MAIN ACTIVE CHAT WINDOW -->
          <main class="flex-1 h-full min-w-0 flex flex-col bg-surface relative z-10">
            
            <!-- Top Chat Header -->
            <header class="h-16 px-4 flex items-center justify-between bg-surface-container-low/90 backdrop-blur-md border-b border-outline-variant/15 relative z-30">
              <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="toggleBeamInspector()">
                <div class="relative flex-shrink-0">
                  <img id="active-chat-avatar" class="w-10 h-10 rounded-full object-cover" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCT9Bu5Xq_ugLiLR2OQkkNqsKQtPAPxutKjY5qm1emXbtZc5B96Nb4eubxQIzbxmBE6cKrhLxcsQbXwpfLMWeoNwzgmKapn9gGFvZvxpwbyd6biYegcKYP2HKcqajo3-sxOn7gvXrU5UATaSbdj8jXheuKfdcDQPUMMoDUOBvsygPhQ7ryL4kewYiGsDxCw6C4iHZ_aTNpv_WwpqOobNHlLinAvZXPq_uLxk7tqwXqcqDTTtkJEnHs"/>
                  <span id="active-chat-status-dot" class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span id="active-chat-name" class="text-sm font-bold text-on-surface truncate">Elena Rodriguez</span>
                    <span class="material-symbols-outlined text-[16px] text-primary" style="font-variation-settings: 'FILL' 1;">verified</span>
                  </div>
                  <span id="active-chat-status-text" class="text-[11px] text-emerald-400 font-medium">En ligne</span>
                </div>
              </div>

              <!-- Chat action buttons -->
              <div class="flex items-center gap-1">
                <button onclick="startVoiceCall()" class="w-10 h-10 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Appel audio">
                  <span class="material-symbols-outlined text-[22px]">call</span>
                </button>
                <button onclick="startVideoCall()" class="w-10 h-10 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Appel vidéo">
                  <span class="material-symbols-outlined text-[22px]">videocam</span>
                </button>
                <button onclick="focusChatSearch()" class="w-10 h-10 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer" title="Rechercher dans la discussion">
                  <span class="material-symbols-outlined text-[22px]">search</span>
                </button>
                <button onclick="toggleBeamInspector()" class="w-10 h-10 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" id="toggle-inspector" title="Infos sur la conversation">
                  <span class="material-symbols-outlined text-[22px]">info</span>
                </button>
              </div>
            </header>

            <!-- Message Thread Stream -->
            <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6" id="message-scroll-area">
              
              <!-- Chat Date Separator -->
              <div class="flex items-center justify-center my-2">
                <span class="px-3 py-1 rounded-full bg-surface-container text-outline text-[11px] font-medium">Aujourd'hui, 14:10</span>
              </div>

              <!-- Incoming Message 1 (Elena) -->
              <div class="flex items-end gap-2.5 max-w-xl group">
                <img class="w-7 h-7 rounded-full object-cover mb-1 flex-shrink-0" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZFG7bDaapGf9HmaiF_2QAYVLvb6QxIwqDcl7oYhlAqaC5AhZJsea7FtPpwwVfrv24cl3gj-wvfS0udt2K89QepH6sTtGzFPmQ1or6L4PZLDKbFE97P9h4tiUPhTH8H36mRdVZKIM98xwx_U8Exv3XotKYbKEnU6UwYYG04Ey9JexaK7f9bveut3BH0-N0vFPmjuBpGr4ev7_eQY5LJ1SEp8UopWk1ppCMz0HqgClEW8T9YCKBMdo"/>
                <div class="flex flex-col gap-1 items-start">
                  <div class="relative bg-surface-container-high text-on-surface px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs shadow-sm">
                    Salut Alex ! J'ai passé en revue les maquettes du flux principal et du module de messagerie.
                  </div>
                  <span class="text-[10px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">14:12</span>
                </div>
              </div>

              <!-- Incoming Message 2 with Rich File Preview -->
              <div class="flex items-end gap-2.5 max-w-lg group">
                <div class="w-7 h-7 flex-shrink-0"></div>
                <div class="flex flex-col gap-1 items-start w-full">
                  <div class="bg-surface-container-high rounded-2xl rounded-bl-sm overflow-hidden p-3 w-full shadow-md border border-outline-variant/10">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center flex-shrink-0 shadow-inner">
                        <span class="material-symbols-outlined text-on-primary text-[26px]">design_services</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <h4 class="text-xs font-bold text-on-surface truncate">Midnight Pulse System 2.0.fig</h4>
                        <p class="text-outline text-[11px]">Fichier Figma • 24.8 MB</p>
                      </div>
                    </div>
                    <div class="mt-3 pt-2.5 flex items-center justify-between border-t border-outline-variant/10">
                      <span class="text-primary font-medium text-[12px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-[15px]">cloud_done</span> Synchronisé
                      </span>
                      <button onclick="previewFigmaFile()" class="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-[12px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer">
                        <span>Ouvrir dans Figma</span>
                        <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                      </button>
                    </div>
                  </div>
                  <span class="text-[10px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">14:14</span>
                </div>
              </div>

              <!-- Outgoing Message 1 (User) -->
              <div class="flex flex-col items-end gap-1 ml-auto max-w-xl group">
                <div class="relative bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container px-4 py-2.5 rounded-2xl rounded-br-sm text-xs shadow-md">
                  Incroyable boulot ! Les flous d'arrière-plan et le contraste sur les cartes de profil sont impeccables.
                </div>
                <div class="flex items-center gap-1 mr-1">
                  <span class="text-[10px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">14:18</span>
                  <span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">done_all</span>
                </div>
              </div>

              <!-- Outgoing Message 2 (User) -->
              <div class="flex flex-col items-end gap-1 ml-auto max-w-xl group">
                <div class="relative bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container px-4 py-2.5 rounded-2xl rounded-br-sm text-xs shadow-md">
                  Est-ce qu'on garde le volet d'infos rétractable à droite comme sur Messenger ?
                </div>
                <div class="flex items-center gap-1 mr-1">
                  <span class="text-[10px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">14:19</span>
                  <span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">done_all</span>
                </div>
              </div>

              <!-- Incoming Message with Voice Note & Reactions -->
              <div class="flex items-end gap-2.5 max-w-md group">
                <img class="w-7 h-7 rounded-full object-cover mb-1 flex-shrink-0" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCuL1cc2Jm-Pr4YofHtrnhQCWLwfV_08mRcVC7yceeyFGHKkUYcg-kUBhrA2oQ4C1Z8GiRBnGhOgFtLBJ2m4FoTLFX9pT0ot_kviJjsWbfKqd7S_Op1iuLw4pqw5N20pZUUc4i4DqHQZCpEp3L_k3upPd7iV_kilAdEUQUAwNorrOP-GnGgvRU81j5Z31jMW-u_UY3fuZOx9Z3ybqKZ56jGUkPBOxyNoIcsy43-dUWG6ZzVGmeAaqI"/>
                <div class="flex flex-col gap-1 items-start">
                  <div class="relative bg-surface-container-high text-on-surface px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs shadow-sm">
                    Exactement, c'est ultra pratique pour retrouver les médias partagés, les liens et les fichiers sans quitter la discussion.
                  </div>
                  
                  <!-- Voice note audio capsule -->
                  <div class="relative bg-surface-container-high text-on-surface p-3 rounded-2xl rounded-bl-sm w-72 flex items-center gap-3 shadow-sm mt-1 border border-outline-variant/10">
                    <button onclick="toggleVoicePlayback(this)" class="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 shadow hover:scale-105 transition-transform cursor-pointer">
                      <span class="material-symbols-outlined text-[22px]">play_arrow</span>
                    </button>
                    <div class="flex-1 flex flex-col gap-1">
                      <!-- SVG Audio Waveform -->
                      <div class="flex items-center gap-0.5 h-6" id="audio-waveform-bars">
                        <div class="w-1 bg-primary rounded-full h-2"></div>
                        <div class="w-1 bg-primary rounded-full h-4"></div>
                        <div class="w-1 bg-primary rounded-full h-5"></div>
                        <div class="w-1 bg-primary rounded-full h-3"></div>
                        <div class="w-1 bg-primary rounded-full h-6"></div>
                        <div class="w-1 bg-primary rounded-full h-4"></div>
                        <div class="w-1 bg-primary rounded-full h-2"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-5"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-3"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-6"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-4"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-2"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-5"></div>
                        <div class="w-1 bg-outline-variant rounded-full h-3"></div>
                      </div>
                      <div class="flex justify-between items-center text-[10px] text-outline font-mono">
                        <span id="voice-timer">0:14</span>
                        <span>0:38</span>
                      </div>
                    </div>
                  </div>

                  <!-- Emoji reactions badges -->
                  <div class="flex items-center gap-1 -mt-2 ml-3 relative z-10">
                    <button onclick="incrementReaction(this)" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface text-[12px] shadow-sm hover:scale-105 transition cursor-pointer">
                      ❤️ <span class="font-bold">3</span>
                    </button>
                    <button onclick="incrementReaction(this)" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface text-[12px] shadow-sm hover:scale-105 transition cursor-pointer">
                      🔥 <span class="font-bold">2</span>
                    </button>
                  </div>
                  <span class="text-[10px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">14:26</span>
                </div>
              </div>

              <!-- Animated Typing Indicator -->
              <div class="flex items-center gap-2 max-w-xs" id="beam-typing-indicator">
                <img class="w-6 h-6 rounded-full object-cover" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAh5TADSyxu_MB2nLAbbZL7b0Qg34-tRcH0nH-DTIhP7eNGG_GWxJ5sisZWXQdvfOWZ852-l3aC9Ueel59Ly0aZBgtxWLGmB_rqIxMJxVTJljlYc_pmzYBbxh7LxQ-fwHY1udleIereWgocQ-y3keK0aRtOhZNC9eFjt9Ofmb7fGSKM6uRU2OKvzwUQYOn2FyAXs37T1puuwSl3voyH27UEfivy0u-zZvkYmLGT3Cx9QU_RQ2MYdos"/>
                <div class="px-3.5 py-2 rounded-full bg-surface-container-high flex items-center gap-1.5 shadow-sm">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 0ms;"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 150ms;"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style="animation-delay: 300ms;"></span>
                </div>
                <span class="text-[11px] text-outline italic">Elena écrit...</span>
              </div>

            </div>

            <!-- Bottom Chat Input Composer Bar -->
            <footer class="p-3 lg:p-4 bg-surface-container-low/90 backdrop-blur-md border-t border-outline-variant/15 relative z-30">
              <div class="flex items-center gap-2">
                
                <!-- Attachment Tools -->
                <div class="flex items-center gap-1">
                  <button onclick="triggerBeamAttachment('file')" class="w-9 h-9 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Ajouter un fichier ou sondage">
                    <span class="material-symbols-outlined text-[20px]">add_circle</span>
                  </button>
                  <button onclick="triggerBeamAttachment('photo')" class="w-9 h-9 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Envoyer une photo">
                    <span class="material-symbols-outlined text-[20px]">photo_library</span>
                  </button>
                  <button onclick="triggerBeamAttachment('sticker')" class="w-9 h-9 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Autocollants & GIFs">
                    <span class="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                  </button>
                  <button onclick="triggerBeamAttachment('mic')" class="w-9 h-9 rounded-full hover:bg-surface-container-high text-primary flex items-center justify-center transition-colors cursor-pointer" title="Message vocal">
                    <span class="material-symbols-outlined text-[20px]">mic</span>
                  </button>
                </div>

                <!-- Text Input Field -->
                <div class="flex-1 relative flex items-center">
                  <input class="w-full pl-4 pr-10 py-2.5 rounded-full bg-surface-container text-on-surface placeholder:text-outline text-xs focus:outline-none focus:bg-surface-container-high transition-colors" id="chat-input" placeholder="Écrivez un message..." type="text"/>
                  <button onclick="insertQuickEmoji('✨')" class="absolute right-3 text-outline hover:text-primary transition-colors cursor-pointer" title="Choisir un emoji">
                    <span class="material-symbols-outlined text-[20px]">add_reaction</span>
                  </button>
                </div>

                <!-- Quick Send / Like Action -->
                <button class="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-container to-secondary flex items-center justify-center text-on-primary-container shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer" id="btn-send-message">
                  <span class="material-symbols-outlined text-[20px]">thumb_up</span>
                </button>
              </div>
            </footer>
          </main>

          <!-- RIGHT COLUMN: CONVERSATION DETAILS / INSPECTOR (Collapsible) -->
          <aside class="w-80 flex-shrink-0 flex flex-col h-full bg-surface-container-lowest border-l border-outline-variant/15 overflow-y-auto relative z-20 transition-all duration-300" id="conversation-inspector">
            
            <!-- User Profile Header -->
            <div class="p-6 flex flex-col items-center text-center border-b border-outline-variant/10">
              <div class="relative mb-3">
                <img id="inspector-avatar" class="w-20 h-20 rounded-full object-cover shadow-lg p-[3px] bg-gradient-to-tr from-primary to-secondary-container" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBccgO6UYF9aRUkCS-c75YV45YS4BcqXyVBadkcDGfway2zNxk-cPayKMV1gJSdf8WxZo7OkkhBMpfZANHHA4VLrRL0fVc3BYnEWJ2j1zODAYVv5Ive_vp3_7GkXINw4t36uW3Z09vg-3xVlBJ9H7qrmuLX9JKV_M02hRS5L37-HKRWI1VdPHJIpA-uz-C0ApKwo2__kcRPK5qza0AAvvXPX-bZjLvxXpvrYHG9AykauwjSZK1rtlc"/>
                <span id="inspector-status-dot" class="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-surface shadow-md"></span>
              </div>
              
              <div class="flex items-center gap-1 justify-center">
                <h2 id="inspector-name" class="text-base font-bold text-on-surface">Elena Rodriguez</h2>
                <span class="material-symbols-outlined text-[18px] text-primary" style="font-variation-settings: 'FILL' 1;">verified</span>
              </div>
              <p id="inspector-handle" class="text-outline text-xs mt-0.5 font-mono">@elena_codes</p>
              
              <span id="inspector-role" class="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-surface-container text-primary text-[11px] font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-primary"></span> UI Architect & Lead Space
              </span>

              <!-- Quick Actions Row -->
              <div class="flex items-center justify-center gap-4 mt-4 w-full">
                <div onclick="viewContactProfile()" class="flex flex-col items-center gap-1 cursor-pointer group">
                  <div class="w-10 h-10 rounded-full bg-surface-container group-hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors">
                    <span class="material-symbols-outlined text-[20px]">account_circle</span>
                  </div>
                  <span class="text-[11px] text-outline group-hover:text-on-surface font-medium">Profil</span>
                </div>
                <div onclick="toggleMuteContact()" class="flex flex-col items-center gap-1 cursor-pointer group">
                  <div class="w-10 h-10 rounded-full bg-surface-container group-hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors">
                    <span class="material-symbols-outlined text-[20px]" id="mute-icon">notifications_off</span>
                  </div>
                  <span class="text-[11px] text-outline group-hover:text-on-surface font-medium">Sourdine</span>
                </div>
                <div onclick="focusChatSearch()" class="flex flex-col items-center gap-1 cursor-pointer group">
                  <div class="w-10 h-10 rounded-full bg-surface-container group-hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors">
                    <span class="material-symbols-outlined text-[20px]">search</span>
                  </div>
                  <span class="text-[11px] text-outline group-hover:text-on-surface font-medium">Chercher</span>
                </div>
              </div>
            </div>

            <!-- Settings & Inspector Accordion Items -->
            <div class="p-4 pb-8 space-y-3">
              
              <!-- Accordion 1: Thème et personnalisation -->
              <details class="group rounded-2xl bg-surface-container/40 open:bg-surface-container/70 transition-colors" open>
                <summary class="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                  <span class="text-xs font-bold text-on-surface">Personnalisation</span>
                  <span class="material-symbols-outlined text-outline text-[20px] transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div class="px-3 pb-3 space-y-1">
                  <div onclick="cycleChatTheme()" class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                    <div class="flex items-center gap-2">
                      <span class="w-4 h-4 rounded-full bg-gradient-to-r from-primary to-secondary"></span>
                      <span class="text-xs text-on-surface">Thème de discussion</span>
                    </div>
                    <span id="chat-theme-name" class="text-outline text-[11px] font-semibold">Midnight Neon</span>
                  </div>
                  <div onclick="changeQuickEmoji()" class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                    <div class="flex items-center gap-2">
                      <span class="text-[16px]">👍</span>
                      <span class="text-xs text-on-surface">Modifier l'émoji rapide</span>
                    </div>
                    <span class="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
                  </div>
                  <div onclick="promptNickname()" class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-outline text-[18px]">badge</span>
                      <span class="text-xs text-on-surface">Modifier les pseudonymes</span>
                    </div>
                    <span class="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
                  </div>
                </div>
              </details>

              <!-- Accordion 2: Médias et fichiers partagés -->
              <details class="group rounded-2xl bg-surface-container/40 open:bg-surface-container/70 transition-colors" open>
                <summary class="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                  <span class="text-xs font-bold text-on-surface">Médias et documents</span>
                  <span class="material-symbols-outlined text-outline text-[20px] transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div class="p-3 pt-0">
                  <!-- 6 Image Thumbnails Grid -->
                  <div class="grid grid-cols-3 gap-1.5 my-2">
                    <div class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative">
                      <img class="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300" alt="UI Dashboard Preview" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDerC9eBLExi6467Xp3JGWTx_eYt4Nx2z3P9Jm-sH88Rmb75bJVo1QekAXv1YnSFBzdDtHjzKHD9OxBbE4bREV4jObgT2Ds-16z2p73zMxads1LlVPBr19PhELaxtlw1yCuaQfX6uy5eoHqtlrBuDVPJ6fWMGg6q2Gd35s_6Ek6_aAmGg9yOhGvp6g9kCnBJ1KT_wP-dS94q-aynJ5Y789MP4-Ib-2XxclniZtwFEKbDSyrkKyC-Gw"/>
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative">
                      <img class="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300" alt="Cyberpunk cityscape" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCi5zOIfEZt-8CmWY3-Ve0E_1jYmY8ePQ8aqY63ofBO8ZVpEabHcGk05Oain6wHvEIvgrJrjtBBWl2qREjml4HHREXvU0TnnZlxaO9eViVCROUHWDuNTPxr9SuHxlKcS-mRUwRsaoWuZ_TlZzOCEK2ewAlAeB-fs6tVPOptvCVS9iynQTIXDLZuArqLs9VqdV14G-9Unc9w34W32Ua90hlL549n0rsH-Vc-A8Z3Y1dsxMp4aFubMtk"/>
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative">
                      <img class="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300" alt="3D Crystal Glass" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkdPW90JNWKD_eFRW6Ta5Xvbjb6syzMnmEL0r2uqbsE60HS9A-xSYsOS9VWjh7RCOwgyFtP2MaJqxIvRStpGvoPA6wdfq31TU7DpN7KTmSPmsWurHyGnHpShiTtvAsWnP3SNT2IjpQgcP2YfMd4jQQQOydVLhaAn26al4v6_W05IoATP2vEf-baNBJVl_zWiy4x9IqRXqTDA3-SM2s5IM__IJHtDCuWOxVX4_FNYrt8Pweye9NLW0"/>
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative">
                      <img class="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300" alt="Wireframe app schematic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOZarvgPGR2IzrwBYMwAj4vNHxw0n4YfwGrHRHvJFL0phsetJuEnM7MY8j9Ff75lnNOWzEtwol2nGr3XlJBSuTbuCjFBHoqNOJbfqvwFIcL3wKb8Omdgt29_ivuLKKDcKnwqyNG2GpqNvNHFHNNs2-OBuoxprQYNBTAjkGiBOxlvlGMNi3vM-ceRslCN_IE3rH9GCTPtnDHdKsBoFA61P-8wUlQT9I35hJkV0ZJdlhRGTsis2xd1k"/>
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative">
                      <img class="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300" alt="Typography Poster" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsdJW2Et4e7C--s1d_fEmGDebD7Yj863DhWCw7KwqAtzFtMOtdvN8eDgeWqpQIOOKwZ0O1Lzote2W8qQgJdxJnCxN8o3_4G2Bv_a4BNgysPAALmJ8frxfI0GohEXoTMyWsviOAiJPn4HmVeb9QTKMZtNG7cnBfW0cdLkFRn7p_CLZXiHoztm7RazuX-5RmpGUdY6yzvFXdXNMfgkBQ2bovbnXWkVRroeLXfGqjgh6tVpwJKdkijE"/>
                    </div>
                    <div onclick="viewAllMediaModal()" class="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative bg-surface-container-high flex flex-col items-center justify-center text-primary hover:bg-secondary-container transition-colors">
                      <span class="material-symbols-outlined text-[20px]">grid_view</span>
                      <span class="text-[10px] mt-0.5 font-bold">+18</span>
                    </div>
                  </div>

                  <!-- Shared Files List -->
                  <div class="space-y-1.5 mt-2">
                    <div class="flex items-center gap-2 p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-red-400">
                        <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-on-surface truncate">Specs-v2.pdf</p>
                        <p class="text-[10px] text-outline">4.2 MB • 28 Avr</p>
                      </div>
                      <button onclick="downloadSharedDoc('Specs-v2.pdf')" class="text-outline hover:text-on-surface p-1">
                        <span class="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </div>

                    <div class="flex items-center gap-2 p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-purple-300">
                        <span class="material-symbols-outlined text-[18px]">data_object</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-on-surface truncate">Tokens.json</p>
                        <p class="text-[10px] text-outline">18 KB • Hier</p>
                      </div>
                      <button onclick="downloadSharedDoc('Tokens.json')" class="text-outline hover:text-on-surface p-1">
                        <span class="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <!-- Accordion 3: Confidentialité et assistance -->
              <details class="group rounded-2xl bg-surface-container/40 open:bg-surface-container/70 transition-colors">
                <summary class="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                  <span class="text-xs font-bold text-on-surface">Confidentialité & Aide</span>
                  <span class="material-symbols-outlined text-outline text-[20px] transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div class="px-3 pb-3 space-y-1">
                  <div class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                    <div class="flex items-center gap-2 text-on-surface">
                      <span class="material-symbols-outlined text-primary text-[18px]">lock</span>
                      <span class="text-xs">Chiffrement de bout en bout</span>
                    </div>
                    <span class="material-symbols-outlined text-emerald-400 text-[18px]">check</span>
                  </div>
                  <div onclick="blockContactPrompt()" class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors text-red-400">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[18px]">block</span>
                      <span class="text-xs">Bloquer Elena</span>
                    </div>
                  </div>
                  <div onclick="reportAnomalyPrompt()" class="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors text-red-400">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[18px]">report</span>
                      <span class="text-xs">Signaler une anomalie</span>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </div>

      <script>
        (function initMessengerInteractions() {
          const toggleBtn = document.getElementById('toggle-inspector');
          const inspector = document.getElementById('conversation-inspector');
          
          window.toggleBeamInspector = function() {
            if (inspector) {
              inspector.classList.toggle('hidden');
            }
          };

          if (toggleBtn && inspector) {
            toggleBtn.addEventListener('click', () => {
              inspector.classList.toggle('hidden');
            });
          }

          const chatInput = document.getElementById('chat-input');
          const sendBtn = document.getElementById('btn-send-message');
          const scrollArea = document.getElementById('message-scroll-area');

          if (chatInput && sendBtn) {
            chatInput.addEventListener('input', (e) => {
              const val = e.target.value.trim();
              const iconSpan = sendBtn.querySelector('.material-symbols-outlined');
              if (iconSpan) {
                if (val.length > 0) {
                  iconSpan.textContent = 'send';
                } else {
                  iconSpan.textContent = 'thumb_up';
                }
              }
            });

            const handleSendMessage = () => {
              const text = chatInput.value.trim();
              if (!text) {
                appendMessage('👍', true);
              } else {
                appendMessage(text, false);
                chatInput.value = '';
                const iconSpan = sendBtn.querySelector('.material-symbols-outlined');
                if (iconSpan) iconSpan.textContent = 'thumb_up';
              }
            };

            sendBtn.addEventListener('click', handleSendMessage);
            chatInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            });

            function appendMessage(msg, isEmojiOnly) {
              if (!scrollArea) return;
              const msgWrapper = document.createElement('div');
              msgWrapper.className = 'flex flex-col items-end gap-1 ml-auto max-w-xl group animate-fade-in';
              
              const now = new Date();
              const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

              if (isEmojiOnly) {
                msgWrapper.innerHTML = \`
                  <div class="text-4xl p-1 select-none">👍</div>
                  <div class="flex items-center gap-1 mr-1">
                    <span class="text-[10px] text-outline">\${timeStr}</span>
                    <span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">done</span>
                  </div>
                \`;
              } else {
                msgWrapper.innerHTML = \`
                  <div class="relative bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container px-4 py-2.5 rounded-2xl rounded-br-sm text-xs shadow-md">
                    \${escapeHtml(msg)}
                  </div>
                  <div class="flex items-center gap-1 mr-1">
                    <span class="text-[10px] text-outline">\${timeStr}</span>
                    <span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">done</span>
                  </div>
                \`;
              }

              scrollArea.appendChild(msgWrapper);
              scrollArea.scrollTop = scrollArea.scrollHeight;

              // Trigger simulated friendly response
              setTimeout(() => {
                showSimulatedReply();
              }, 1200);
            }

            function showSimulatedReply() {
              if (!scrollArea) return;
              const typingInd = document.getElementById('beam-typing-indicator');
              if (typingInd) typingInd.style.display = 'flex';

              setTimeout(() => {
                if (typingInd) typingInd.style.display = 'none';
                const replyWrapper = document.createElement('div');
                replyWrapper.className = 'flex items-end gap-2.5 max-w-xl group';
                
                const now = new Date();
                const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

                replyWrapper.innerHTML = \`
                  <img class="w-7 h-7 rounded-full object-cover mb-1 flex-shrink-0" alt="Elena Rodriguez" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZFG7bDaapGf9HmaiF_2QAYVLvb6QxIwqDcl7oYhlAqaC5AhZJsea7FtPpwwVfrv24cl3gj-wvfS0udt2K89QepH6sTtGzFPmQ1or6L4PZLDKbFE97P9h4tiUPhTH8H36mRdVZKIM98xwx_U8Exv3XotKYbKEnU6UwYYG04Ey9JexaK7f9bveut3BH0-N0vFPmjuBpGr4ev7_eQY5LJ1SEp8UopWk1ppCMz0HqgClEW8T9YCKBMdo"/>
                  <div class="flex flex-col gap-1 items-start">
                    <div class="relative bg-surface-container-high text-on-surface px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs shadow-sm">
                      Super, j'ai bien reçu ton message ! Le cluster MosaiX synchronise les tokens en temps réel. ✨
                    </div>
                    <span class="text-[10px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">\${timeStr}</span>
                  </div>
                \`;

                scrollArea.appendChild(replyWrapper);
                scrollArea.scrollTop = scrollArea.scrollHeight;
              }, 800);
            }

            function escapeHtml(string) {
              const div = document.createElement('div');
              div.textContent = string;
              return div.innerHTML;
            }
          }

          // Contact Selection
          window.selectBeamContact = function(name, id, isOnline) {
            const nameEl = document.getElementById('active-chat-name');
            const inspectorName = document.getElementById('inspector-name');
            const statusText = document.getElementById('active-chat-status-text');
            const statusDot = document.getElementById('active-chat-status-dot');
            
            if (nameEl) nameEl.textContent = name;
            if (inspectorName) inspectorName.textContent = name;
            if (statusText) statusText.textContent = isOnline ? 'En ligne' : 'Vu récemment';
            if (statusDot) {
              statusDot.className = isOnline 
                ? 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface' 
                : 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-slate-500 ring-2 ring-surface';
            }

            // Highlight conversation in list
            document.querySelectorAll('#beam-conversation-list .conv-item').forEach(el => {
              el.classList.remove('bg-surface-container-high/60', 'border', 'border-primary/20');
            });
          };

          // Filter buttons
          window.setBeamFilter = function(filter, btn) {
            document.querySelectorAll('.beam-filter-btn').forEach(b => {
              b.className = 'beam-filter-btn px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer';
            });
            btn.className = 'beam-filter-btn px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-semibold transition-all cursor-pointer';

            const items = document.querySelectorAll('#beam-conversation-list .conv-item');
            items.forEach(item => {
              const type = item.getAttribute('data-type');
              const unread = item.getAttribute('data-unread') === 'true';
              if (filter === 'all') {
                item.style.display = 'flex';
              } else if (filter === 'unread') {
                item.style.display = unread ? 'flex' : 'none';
              } else if (filter === 'groups') {
                item.style.display = type === 'groups' ? 'flex' : 'none';
              } else if (filter === 'spaces') {
                item.style.display = type === 'spaces' ? 'flex' : 'none';
              }
            });
          };

          // Search filtering
          window.filterBeamConversations = function(query) {
            const q = (query || '').toLowerCase();
            const items = document.querySelectorAll('#beam-conversation-list .conv-item');
            items.forEach(item => {
              const text = item.textContent?.toLowerCase() || '';
              item.style.display = text.includes(q) ? 'flex' : 'none';
            });
          };

          // Audio playback toggle
          window.toggleVoicePlayback = function(btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            const timer = document.getElementById('voice-timer');
            if (!icon) return;
            if (icon.textContent === 'play_arrow') {
              icon.textContent = 'pause';
              if (timer) timer.textContent = '0:22';
            } else {
              icon.textContent = 'play_arrow';
              if (timer) timer.textContent = '0:14';
            }
          };

          // Reaction increments
          window.incrementReaction = function(btn) {
            const span = btn.querySelector('span');
            if (span) {
              const val = parseInt(span.textContent || '0', 10);
              span.textContent = (val + 1).toString();
            }
          };

          // Notification helper
          window.showBeamNotice = window.showBeamNotice || function(message, type) {
            let prefix = "";
            if (type === 'error') prefix = "Erreur: ";
            if (type === 'success') prefix = "Succès: ";
            window.alert(prefix + message);
          };

          // Interaction helpers
          window.promptNewConversation = function() {
            const input = document.getElementById('beam-search-conversations');
            if (input) input.focus();
            window.showBeamNotice("Sélectionnez ou recherchez un contact dans la liste.", "info");
          };

          window.insertQuickEmoji = function(emoji) {
            const input = document.getElementById('chat-input');
            if (input) {
              input.value += emoji;
              input.focus();
              const event = new Event('input', { bubbles: true });
              input.dispatchEvent(event);
            }
          };

          window.triggerBeamAttachment = function(type) {
            window.showBeamNotice("Module Beam: Pièce jointe (" + type + ") sélectionnée.", "info");
          };

          window.previewFigmaFile = function() {
            window.showBeamNotice("Ouverture du fichier Figma synchronisé dans le visualiseur partagé.", "info");
          };

          window.startVoiceCall = function() {
            window.showBeamNotice("Lancement de l'appel audio chiffré de bout en bout via Beam RTC...", "info");
          };

          window.startVideoCall = function() {
            window.showBeamNotice("Lancement de l'appel vidéo HD via Beam Video Mesh...", "info");
          };

          window.focusChatSearch = function() {
            const searchInput = document.getElementById('beam-search-conversations');
            if (searchInput) searchInput.focus();
          };

          window.downloadSharedDoc = function(doc) {
            window.showBeamNotice("Téléchargement sécurisé du document: " + doc, "success");
          };

          window.viewAllMediaModal = function() {
            window.showBeamNotice("Affichage de la galerie des 24 médias partagés.", "info");
          };

          window.viewContactProfile = function() {
            window.location.href = '/citadelle/profile';
          };

          window.toggleMuteContact = function() {
            const icon = document.getElementById('mute-icon');
            if (icon) {
              if (icon.textContent === 'notifications_off') {
                icon.textContent = 'notifications';
                window.showBeamNotice("Notifications réactivées pour cette conversation.", "info");
              } else {
                icon.textContent = 'notifications_off';
                window.showBeamNotice("Conversation mise en sourdine.", "info");
              }
            }
          };

          window.cycleChatTheme = function() {
            const el = document.getElementById('chat-theme-name');
            if (el) {
              el.textContent = el.textContent === 'Midnight Neon' ? 'Emerald Pulse' : 'Midnight Neon';
            }
          };

          window.changeQuickEmoji = function() {
            const emojis = ['🔥', '✨', '👍', '🚀', '❤️', '👏'];
            const sendBtnIcon = document.querySelector('#btn-send-message span');
            const current = sendBtnIcon ? sendBtnIcon.textContent : '🔥';
            const nextIdx = (emojis.indexOf(current) + 1) % emojis.length;
            const nextEmoji = emojis[nextIdx];
            if (sendBtnIcon) sendBtnIcon.textContent = nextEmoji;
            window.showBeamNotice("Emoji rapide configuré : " + nextEmoji, "info");
          };

          window.promptNickname = function() {
            const current = document.getElementById('active-chat-name');
            const newName = (current && current.textContent) ? (current.textContent.trim() + " ⭐") : "Contact VIP";
            if (current) current.textContent = newName;
            window.showBeamNotice("Pseudonyme mis à jour : " + newName, "success");
          };

          window.blockContactPrompt = function() {
            window.showBeamNotice("Contact bloqué avec succès.", "success");
          };

          window.reportAnomalyPrompt = function() {
            window.showBeamNotice("Signalement de sécurité transmis à l'équipe de gouvernance Imperia.", "success");
          };
        })();
      </script>
    `;
  },
};

export const beamNavigationItems = [
  { id: "nav-chat", label: "Messages", route: "/beam/chat", pageView: BeamConversationPageView },
];

export function registerBeamAdminPages() {
  return [
    { applicationId: "@apps/beam", entrypoint: "messaging-admin", order: 10, permission: "beam:message:read" }
  ];
}

export const beamContributions: ContributionContract[] = [
  {
    id: "beam:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/beam",
    kind: "navigation",
    title: "Beam Chat",
    route: "/beam/chat",
    icon: "💬",
    placements: [{ id: "p-beam-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 45 }],
  },
  {
    id: "beam:chat-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/beam",
    kind: "page",
    title: "Beam — Instant Messenger",
    route: "/beam/chat",
    placements: [{ id: "p-beam-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: BeamConversationPageView.render() },
  },
];
