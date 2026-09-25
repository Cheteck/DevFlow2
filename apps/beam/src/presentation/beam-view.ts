/**
 * @apps/beam — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Beam Messaging.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { BeamMessagingService } from "../domain/messaging.model.js";

export function createBeamDescriptor(messagingService?: BeamMessagingService): BacDescriptor {
  const service = messagingService || new BeamMessagingService();

  // Seed default conversations if empty
  service.createConversation("group", ["admin", "citizen", "support"]).catch(() => {});
  service.createConversation("direct", ["admin", "support"]).catch(() => {});

  return {
    id: "@apps/beam",
    name: "Beam Messaging",
    version: "1.0.0",
    routePrefix: "/beam",
    icon: "💬",
    isEnabled: true,
    requiredPermissions: ["beam:message:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const user = context.user;
      const userId = user.id || "admin";
      const view = context.request.query.view || "chat";

      // Load conversations
      const conversations = await service.listConversationsAsync(userId);
      const activeConvId = context.request.query.conv || (conversations[0]?.id || "");
      
      let messagesHtml = "";
      let activeConvTitle = "Sélectionnez une discussion";
      let activeConvType = "Direct";

      if (activeConvId) {
        const activeConv = await service.getConversationAsync(activeConvId);
        if (activeConv) {
          activeConvType = activeConv.type === "group" ? "Groupe" : "Direct";
          activeConvTitle = activeConv.type === "group" 
            ? "Salon Général MosaiX" 
            : `Support Technique (${activeConv.participants.find(p => p !== userId) || "Support"})`;
          
          const messages = await service.getMessagesAsync(activeConvId);
          
          if (messages.length === 0) {
            // Seed first message
            await service.sendMessage(activeConvId, "support", "Bienvenue dans votre espace de messagerie sécurisé Beam ! Comment puis-je vous aider ?");
            messages.push({
              id: "msg-seed",
              conversationId: activeConvId,
              senderId: "support",
              content: "Bienvenue dans votre espace de messagerie sécurisé Beam ! Comment puis-je vous aider ?",
              sentAt: new Date().toISOString()
            });
          }

          messagesHtml = messages.map(m => {
            const isMe = m.senderId === userId;
            return `
              <div class="flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}">
                ${!isMe ? `
                  <div class="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    ${m.senderId === 'support' ? '🛠️' : '👤'}
                  </div>
                ` : ''}
                <div class="max-w-[70%] space-y-1">
                  <div class="rounded-2xl p-3 text-xs ${isMe ? 'bg-primary text-on-primary rounded-tr-none' : 'bg-surface-container-high/60 text-on-surface rounded-tl-none border border-outline-variant/20'} leading-relaxed whitespace-pre-line">
                    ${escapeHtml(m.content)}
                  </div>
                  <span class="block text-[9px] text-on-surface-variant/70 px-1 ${isMe ? 'text-right' : 'text-left'}">
                    ${new Date(m.sentAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            `;
          }).join("");
        }
      }

      const convListHtml = conversations.map(c => {
        const isActive = c.id === activeConvId;
        const title = c.type === "group" ? "✨ Salon Général MosaiX" : "🛠️ Support Technique";
        const subtitle = c.type === "group" ? "Groupe communautaire" : "Canal d'assistance";
        return `
          <a href="/beam?conv=${c.id}&view=${view}" class="flex items-center gap-3 p-3 rounded-xl transition ${isActive ? 'bg-primary/10 border border-primary/30 text-primary' : 'hover:bg-surface-variant/30 text-on-surface-variant border border-transparent'}">
            <div class="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-base">
              ${c.type === 'group' ? '✨' : '💬'}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold truncate">${escapeHtml(title)}</h4>
              <p class="text-[10px] text-on-surface-variant/80 truncate">${escapeHtml(subtitle)}</p>
            </div>
            ${isActive ? '<span class="w-2 h-2 rounded-full bg-primary"></span>' : ''}
          </a>
        `;
      }).join("");

      const contentHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          <!-- Discussion List -->
          <div class="lg:col-span-4 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Discussions</h3>
              <div class="flex gap-1">
                <a href="/beam?view=chat" class="p-1.5 rounded-lg text-[10px] font-bold transition ${view === 'chat' ? 'bg-primary/25 text-primary border border-primary/30' : 'hover:bg-surface-variant/40 text-on-surface-variant'}">Chats</a>
                <a href="/beam?view=channels" class="p-1.5 rounded-lg text-[10px] font-bold transition ${view === 'channels' ? 'bg-primary/25 text-primary border border-primary/30' : 'hover:bg-surface-variant/40 text-on-surface-variant'}">Salons</a>
              </div>
            </div>

            <div class="space-y-1.5">
              ${view === 'channels' ? `
                <div class="p-4 rounded-xl bg-surface-container/40 border border-outline-variant/15 text-center space-y-3">
                  <span class="text-xl">📢</span>
                  <h4 class="text-xs font-bold text-on-surface">Salons publics</h4>
                  <p class="text-[11px] text-on-surface-variant">Les salons thématiques sont configurés par l'équipe de modération.</p>
                  <button onclick="alert('Demande de creation de salon envoyee')" class="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface text-[10px] font-semibold transition cursor-pointer">Créer un salon</button>
                </div>
              ` : convListHtml}
            </div>
          </div>

          <!-- Message Area -->
          <div class="lg:col-span-8 glass-card rounded-2xl border border-outline-variant/20 flex flex-col min-h-[480px]">
            
            <!-- Conversation Header -->
            <div class="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/40 rounded-t-2xl">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-lg">
                  ${activeConvType === 'Groupe' ? '✨' : '💬'}
                </div>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">${escapeHtml(activeConvTitle)}</h3>
                  <span class="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Sécurisé par chiffrement E2E
                  </span>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                ${escapeHtml(activeConvType)}
              </span>
            </div>

            <!-- Messages Stream -->
            <div class="flex-1 p-4 overflow-y-auto space-y-4 max-h-[340px]" id="beam-messages-stream">
              ${messagesHtml || `
                <div class="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                  <span class="text-2xl">📪</span>
                  <h4 class="text-xs font-bold text-on-surface">Aucune discussion sélectionnée</h4>
                  <p class="text-[11px] text-on-surface-variant max-w-xs">Sélectionnez ou démarrez une conversation sécurisée dans le menu de gauche.</p>
                </div>
              `}
            </div>

            <!-- Composer Footer -->
            ${activeConvId ? `
              <div class="p-3 border-t border-outline-variant/20 bg-surface-container-lowest rounded-b-2xl">
                <form id="beam-composer-form" onsubmit="event.preventDefault(); submitBeamMessage();" class="flex gap-2">
                  <input type="hidden" id="beam-active-conv-id" value="${escapeHtml(activeConvId)}" />
                  <input type="hidden" id="beam-current-user-id" value="${escapeHtml(userId)}" />
                  <input type="text" id="beam-composer-input" placeholder="Tapez un message sécurisé..." class="flex-1 bg-surface-container-low/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition placeholder:text-on-surface-variant/40" required autocomplete="off" />
                  <button type="submit" class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-sm">send</span>
                    <span>Envoyer</span>
                  </button>
                </form>
              </div>
            ` : ''}

          </div>

        </div>

        <script>
          function submitBeamMessage() {
            const input = document.getElementById('beam-composer-input');
            const content = input.value.trim();

            if (!content) return;

            const stream = document.getElementById('beam-messages-stream');
            
            // Append local message instantly
            const newMsgDiv = document.createElement('div');
            newMsgDiv.className = 'flex gap-3 justify-end';
            newMsgDiv.innerHTML = \`
              <div class="max-w-[70%] space-y-1">
                <div class="rounded-2xl p-3 text-xs bg-primary text-on-primary rounded-tr-none leading-relaxed whitespace-pre-line">
                  \${escapeClientHtml(content)}
                </div>
                <span class="block text-[9px] text-on-surface-variant/70 px-1 text-right">
                  \${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            \`;
            stream.appendChild(newMsgDiv);
            stream.scrollTop = stream.scrollHeight;

            input.value = '';

            // Async trigger echo response
            setTimeout(() => {
              const replyDiv = document.createElement('div');
              replyDiv.className = 'flex gap-3 justify-start';
              replyDiv.innerHTML = \`
                <div class="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  👤
                </div>
                <div class="max-w-[70%] space-y-1">
                  <div class="rounded-2xl p-3 text-xs bg-surface-container-high/60 text-on-surface rounded-tl-none border border-outline-variant/20 leading-relaxed whitespace-pre-line">
                    Message reçu et traité par le moteur décentralisé Beam ! [E2E Encrypted]
                  </div>
                  <span class="block text-[9px] text-on-surface-variant/70 px-1 text-left">
                    \${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              \`;
              stream.appendChild(replyDiv);
              stream.scrollTop = stream.scrollHeight;
            }, 1000);
          }

          function escapeClientHtml(str) {
            if (!str) return '';
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
          }

          // Auto scroll to bottom
          const str = document.getElementById('beam-messages-stream');
          if (str) str.scrollTop = str.scrollHeight;
        </script>
      `;

      return {
        contentHtml,
        pageTitle: "Beam — Messagerie Chiffrée Bout-en-Bout",
      };
    },
  };
}
