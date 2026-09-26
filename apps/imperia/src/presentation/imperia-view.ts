/**
 * @apps/imperia — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Imperia Governance.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";

export function createImperiaDescriptor(): BacDescriptor {
  return {
    id: "@apps/imperia",
    name: "Imperia Governance",
    version: "1.0.0",
    routePrefix: "/imperia",
    icon: "🏛️",
    isEnabled: true,
    requiredPermissions: ["imperia:governance:manage"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const user = context.user;
      
      // Strict authorization guard within the descriptor
      const isAdmin = user.roles?.includes("admin") || user.id === "admin";
      if (!isAdmin) {
        throw new Error("Accès interdit : Rôle 'Platform Governor' ou 'Platform Admin' requis pour accéder aux registres d'Imperia.");
      }

      const activeTab = context.request.query.tab || "status";

      let innerContentHtml: string;
      if (activeTab === "policies") {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Règles de Conformité OPA & Rego</h3>
            <p class="text-[11px] text-on-surface-variant">Définition déclarative et évaluation en temps réel des règles de sécurité de la plateforme.</p>
            
            <div class="p-3 bg-surface-container-lowest font-mono text-[10px] text-primary rounded-xl border border-outline-variant/15 whitespace-pre overflow-x-auto leading-relaxed">
package platform.authz

default allow = false

# Allow platform admins bypass rules
allow {
    input.user.roles[_] == "admin"
}

# Restrict critical endpoints
allow {
    input.action == "read"
    input.resource == "public"
}
            </div>
          </div>
        `;
      } else if (activeTab === "audit") {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Journal de Sécurité & Audit de Dérive</h3>
            
            <div class="space-y-2 text-xs">
              <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                <div>
                  <h4 class="font-bold">MFA Activé pour Sarah Connor</h4>
                  <p class="text-[10px] text-on-surface-variant">Wilaya de Jijel • il y a 5 mins</p>
                </div>
                <span class="text-[10px] text-emerald-400 font-bold">SUCCESS</span>
              </div>
              <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                <div>
                  <h4 class="font-bold">Tentative de contournement bypass</h4>
                  <p class="text-[10px] text-on-surface-variant">IP: 198.51.100.42 • il y a 1 heure</p>
                </div>
                <span class="text-[10px] text-rose-400 font-bold">BLOCKED</span>
              </div>
            </div>
          </div>
        `;
      } else if (activeTab === "plateforme") {
        // Platform configuration (V2.3 doctrine: theme identity is
        // admin-owned). Values load client-side from the admin APIs —
        // the descriptor stays dependency-free (no shell imports).
        innerContentHtml = `
          <div class="space-y-6">
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Thème de la plateforme</h3>
              <p class="text-[11px] text-on-surface-variant">Choix administrateur : persisté en base (table <span class="font-mono">platform_settings</span>), appliqué à tous les utilisateurs au prochain chargement. Les utilisateurs ne changent que le mode (clair/sombre).</p>
              <div id="platform-theme-status" class="text-[11px] text-on-surface-variant">Chargement des thèmes…</div>
              <div id="platform-theme-gallery" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"></div>
            </div>
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Configuration effective (lecture seule)</h3>
              <p class="text-[11px] text-on-surface-variant">Valeurs réellement appliquées : environnement, puis surcharges admin persistées. Les secrets ne sont jamais exposés.</p>
              <div id="platform-settings-table" class="text-[11px] text-on-surface-variant">Chargement…</div>
            </div>
          </div>
          <script>
          (function () {
            function esc(s) {
              return String(s).replace(/[&<>"']/g, function (c) {
                return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
              });
            }
            var gallery = document.getElementById("platform-theme-gallery");
            var status = document.getElementById("platform-theme-status");
            if (!gallery || gallery.dataset.loaded) return;
            gallery.dataset.loaded = "1";
            fetch("/api/admin/platform-theme", { headers: { "Accept": "application/json" } })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (!data.success) throw new Error(data.error || "Accès refusé");
                status.textContent = "Thème actif : " + data.themeId + " — " + data.themes.length + " thèmes disponibles.";
                gallery.innerHTML = data.themes.map(function (t) {
                  var active = t.id === data.themeId;
                  return '<button data-theme-id="' + esc(t.id) + '"' +
                    ' class="text-left p-3 rounded-xl border transition ' +
                    (active ? "border-primary" : "border-outline-variant/20 hover:border-primary/60") + '"' +
                    ' style="background:' + esc(t.backgroundColor) + '">' +
                    '<span class="block h-8 rounded-lg mb-2" style="background:' + esc(t.primaryColor) + '"></span>' +
                    '<span class="block text-xs font-bold" style="color:' + esc(t.backgroundColor === "#000000" ? "#ffffff" : "#0f172a") + '">' + esc(t.name) + "</span>" +
                    '<span class="block text-[10px] font-mono" style="color:' + esc(t.backgroundColor === "#000000" ? "#94a3b8" : "#64748b") + '">' + esc(t.id) + (active ? " ● actif" : "") + "</span>" +
                    "</button>";
                }).join("");
                gallery.querySelectorAll("button[data-theme-id]").forEach(function (btn) {
                  btn.addEventListener("click", function () {
                    var id = btn.getAttribute("data-theme-id");
                    status.textContent = "Application de " + id + "…";
                    fetch("/api/admin/platform-theme", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ themeId: id }),
                    })
                      .then(function (r) { return r.json(); })
                      .then(function (res) {
                        if (!res.success) throw new Error(res.error || "Échec");
                        window.location.reload();
                      })
                      .catch(function (e) { status.textContent = "Erreur : " + e.message; });
                  });
                });
              })
              .catch(function (e) { status.textContent = "Erreur : " + e.message; });
            var settingsTable = document.getElementById("platform-settings-table");
            fetch("/api/admin/platform-settings", { headers: { "Accept": "application/json" } })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (!data.success) throw new Error(data.error || "Accès refusé");
                settingsTable.innerHTML = '<div class="space-y-1">' + data.settings.map(function (s) {
                  return '<div class="p-2.5 bg-surface-container rounded-xl flex items-center justify-between gap-3">' +
                    "<div><div class='font-bold text-xs'>" + esc(s.label) + "</div>" +
                    "<div class='text-[10px] font-mono text-on-surface-variant'>" + esc(s.key) + " · " + esc(s.source) + "</div></div>" +
                    "<div class='text-xs font-mono'>" + esc(s.value) + "</div></div>";
                }).join("") + "</div>";
              })
              .catch(function (e) { settingsTable.textContent = "Erreur : " + e.message; });
          })();
          </script>
        `;
      } else {
        // Status & Settings Dashboard
        innerContentHtml = `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
              <span class="text-[10px] text-on-surface-variant font-bold uppercase">Règles Actives</span>
              <div class="text-xl font-bold text-primary">42 Règles Rego</div>
              <p class="text-[10px] text-on-surface-variant">Toutes évaluées nominalement</p>
            </div>
            <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
              <span class="text-[10px] text-on-surface-variant font-bold uppercase">État de Conformité</span>
              <div class="text-xl font-bold text-emerald-400">100% Conforme</div>
              <p class="text-[10px] text-on-surface-variant">Dernier rapport SOC2 / ISO-27001</p>
            </div>
            <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
              <span class="text-[10px] text-on-surface-variant font-bold uppercase">Mode Maintenance</span>
              <div class="text-xl font-bold text-rose-400">Inactif</div>
              <p class="text-[10px] text-on-surface-variant">Bypass administrateurs désactivé</p>
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Subnavigation -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🏛️</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Imperia Governance</h1>
                <p class="text-[11px] text-on-surface-variant">Cabine de pilotage et supervision de conformité de la plateforme</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/imperia?tab=status" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'status' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                État de Conformité
              </a>
              <a href="/imperia?tab=policies" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'policies' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Règles Rego
              </a>
              <a href="/imperia?tab=audit" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'audit' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Journal de Dérive
              </a>
              <a href="/imperia?tab=plateforme" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'plateforme' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Plateforme
              </a>
            </div>
          </div>

          <!-- Active tab content rendering -->
          ${innerContentHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Imperia — Gouvernance & Conformité",
      };
    },
  };
}
