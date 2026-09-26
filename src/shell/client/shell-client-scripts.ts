/**
 * @shell/client — Central Client-Side Shell Scripts
 * Provides unified toast, dialogs, localization, theme, user/space switcher, search, command palette & dev inspector.
 */

export function renderShellToastContainer(): string {
  return `<div id="shell-toast-container" class="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm w-full pointer-events-auto"></div>`;
}

export function renderShellConfirmModal(): string {
  return `
    <div id="shell-confirm-modal" class="fixed inset-0 z-[350] bg-black/60 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div class="w-full sm:max-w-md bg-surface-container-high rounded-t-3xl sm:rounded-2xl p-6 border-t sm:border border-outline-variant/30 shadow-2xl space-y-4 animate-slide-up-mobile pb-8 sm:pb-6" onclick="event.stopPropagation()">
        <!-- Mobile Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden"></div>
        <h3 id="shell-confirm-title" class="font-bold text-base text-on-surface">Confirmation</h3>
        <p id="shell-confirm-message" class="text-xs text-on-surface-variant leading-relaxed"></p>
        <div class="flex items-center justify-end gap-3 pt-2">
          <button id="shell-confirm-cancel" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/40 text-xs font-semibold text-on-surface transition cursor-pointer">
            Annuler
          </button>
          <button id="shell-confirm-ok" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition shadow-md shadow-primary/20 cursor-pointer">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  `;
}

export function getShellClientScripts(): string {
  return `
    <script>
      (function() {
        // Safe Client HTML Escaping
        window.escapeShellHtml = function(str) {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        };

        // Custom Toast Notification System
        window.showToast = function(message, type = 'info', duration = 4000) {
          const container = document.getElementById('shell-toast-container');
          if (!container) return;
          
          const toast = document.createElement('div');
          const borderClass = type === 'error' ? 'border-red-500/50 bg-red-950/90 text-red-200' :
                              type === 'success' ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200' :
                              type === 'warning' ? 'border-amber-500/50 bg-amber-950/90 text-amber-200' :
                              'border-primary/50 bg-surface-container-high/90 text-on-surface';
          
          const icon = type === 'error' ? 'error' :
                       type === 'success' ? 'check_circle' :
                       type === 'warning' ? 'warning' : 'info';
          
          toast.className = 'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl transition-all transform duration-300 translate-y-2 opacity-0 ' + borderClass;
          toast.innerHTML = '<span class="material-symbols-outlined text-lg">' + icon + '</span>' +
                            '<span class="text-xs font-semibold flex-1 leading-snug">' + window.escapeShellHtml(message) + '</span>' +
                            '<button onclick="this.parentElement.remove()" class="p-1 hover:bg-surface-variant/30 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer">' +
                              '<span class="material-symbols-outlined text-sm">close</span>' +
                            '</button>';
          
          container.appendChild(toast);
          
          // Animate in
          requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
          });
          
          // Auto dismiss
          setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-4');
            setTimeout(() => toast.remove(), 300);
          }, duration);
        };

        // Custom Async Confirm Dialog
        window.promiseConfirm = function(title, message) {
          return new Promise((resolve) => {
            const modal = document.getElementById('shell-confirm-modal');
            const titleEl = document.getElementById('shell-confirm-title');
            const msgEl = document.getElementById('shell-confirm-message');
            const okBtn = document.getElementById('shell-confirm-ok');
            const cancelBtn = document.getElementById('shell-confirm-cancel');
            
            if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
              resolve(window.confirm(title + "\\n" + message));
              return;
            }
            
            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
            const handleOk = () => {
              cleanup();
              resolve(true);
            };
            
            const handleCancel = () => {
              cleanup();
              resolve(false);
            };
            
            const cleanup = () => {
              modal.classList.add('hidden');
              modal.classList.remove('flex');
              okBtn.removeEventListener('click', handleOk);
              cancelBtn.removeEventListener('click', handleCancel);
            };
            
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
          });
        };

        // Dynamic Localisation & RTL system
        window.setLocale = function(locale) {
          localStorage.setItem('mosaix_active_locale', locale);
          document.documentElement.lang = locale;
          
          if (locale === 'ar') {
            document.documentElement.dir = 'rtl';
            document.documentElement.classList.add('rtl-mode');
          } else {
            document.documentElement.removeAttribute('dir');
            document.documentElement.classList.remove('rtl-mode');
          }
          
          ['fr', 'en', 'ar'].forEach(l => {
            const btn = document.getElementById('lang-btn-' + l);
            if (btn) {
              if (l === locale) {
                btn.className = 'px-2.5 py-1 rounded-lg transition bg-primary text-on-primary font-bold';
              } else {
                btn.className = 'px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30';
              }
            }
          });
        };

        // Role & Space Switching
        window.switchRole = async function(role) {
          try {
            const res = await fetch('/api/user/switch?role=' + encodeURIComponent(role), { method: 'POST' });
            if (res.ok) {
              window.showToast('Rôle basculé vers : ' + role, 'success');
              setTimeout(() => window.location.reload(), 300);
            } else {
              const data = await res.json().catch(() => ({}));
              window.showToast(data.error || 'Basculement de rôle non autorisé.', 'warning');
            }
          } catch {
            window.location.reload();
          }
        };
        window.switchUserRole = window.switchRole;

        window.switchActiveSpace = async function(spaceId) {
          try {
            await fetch('/api/space/switch?spaceId=' + encodeURIComponent(spaceId || ''), { method: 'POST' });
            window.showToast(spaceId ? 'Espace actif sélectionné' : 'Retour au compte personnel', 'info');
            setTimeout(() => window.location.reload(), 300);
          } catch {
            window.location.reload();
          }
        };

        // Presence Status Management
        window.updatePresenceStatus = function(status) {
          localStorage.setItem('mosaix_presence_status', status);
          const dots = document.querySelectorAll('.user-presence-dot');
          const labels = {
            online: { text: 'En ligne', color: 'bg-emerald-500', ring: 'ring-emerald-400/30' },
            busy: { text: 'Occupé', color: 'bg-amber-500', ring: 'ring-amber-400/30' },
            away: { text: 'Absent', color: 'bg-slate-400', ring: 'ring-slate-400/30' },
            dnd: { text: 'Ne pas déranger', color: 'bg-rose-500', ring: 'ring-rose-400/30' }
          };
          const current = labels[status] || labels.online;
          dots.forEach(dot => {
            dot.className = 'user-presence-dot absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ' + current.color + ' ' + (status === 'online' ? 'animate-pulse' : '');
          });
          const textEl = document.getElementById('usermenu-presence-text');
          if (textEl) textEl.textContent = current.text;
          window.showToast('Statut de présence : ' + current.text, 'info', 2000);
        };

        // Tenant Context Switcher
        window.switchTenant = function(tenantId) {
          localStorage.setItem('mosaix_active_tenant', tenantId);
          const names = {
            'tenant-main': 'MosaiX Global Workspace',
            'tenant-solara': 'Solara Social Org',
            'tenant-imperia': 'Imperia Council Org'
          };
          window.showToast('Organisation active : ' + (names[tenantId] || tenantId), 'info');
        };

        // Overlay visibility helper: 'hidden' and 'flex' must never
        // coexist (same-breakpoint display conflict). JS owns both.
        window.setOverlayOpen = function(menu, btn, open) {
          if (!menu) return;
          if (open) {
            menu.classList.remove('hidden');
            menu.classList.add('flex');
          } else {
            menu.classList.add('hidden');
            menu.classList.remove('flex');
          }
          if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        // Safe User Dropdown Toggle
        window.toggleUserDropdown = function(e) {
          if (e) e.stopPropagation();
          const menu = document.getElementById('user-menu-dropdown');
          const btn = document.getElementById('user-menu-button');
          if (menu) {
            window.setOverlayOpen(menu, btn, menu.classList.contains('hidden'));
          }
        };

        window.toggleMobileDrawer = function() {
          const drawer = document.getElementById('mobile-drawer');
          if (drawer) window.setOverlayOpen(drawer, null, drawer.classList.contains('hidden'));
        };

        window.toggleMobileCreateSheet = function() {
          const sheet = document.getElementById('mobile-create-sheet');
          if (sheet) window.setOverlayOpen(sheet, null, sheet.classList.contains('hidden'));
        };

        window.toggleMobileNotificationsSheet = function() {
          const sheet = document.getElementById('mobile-notifications-sheet');
          if (sheet) window.setOverlayOpen(sheet, null, sheet.classList.contains('hidden'));
        };

        // Command Palette & Dev Inspector Wiring
        window.openCommandPalette = function() {
          const modal = document.getElementById('command-palette-modal');
          const input = document.getElementById('command-palette-input');
          if (modal) {
            window.setOverlayOpen(modal, null, true);
            if (input) setTimeout(() => input.focus(), 50);
          }
        };

        window.closeCommandPalette = function() {
          const modal = document.getElementById('command-palette-modal');
          if (modal) window.setOverlayOpen(modal, null, false);
        };

        window.closeDevInspector = function() {
          const drawer = document.getElementById('dev-inspector-drawer');
          if (drawer) window.setOverlayOpen(drawer, null, false);
        };

        window.toggleDevInspector = function() {
          const drawer = document.getElementById('dev-inspector-drawer');
          if (drawer) window.setOverlayOpen(drawer, null, drawer.classList.contains('hidden'));
        };

        window.markNotificationsAsRead = function() {
          const badges = document.querySelectorAll('.notification-unread-badge');
          badges.forEach(b => b.classList.add('hidden'));
          const notifList = document.getElementById('notifications-list-container');
          const emptyState = document.getElementById('notifications-empty-state');
          if (notifList && emptyState) {
            notifList.classList.add('hidden');
            emptyState.classList.remove('hidden');
          }
          if (typeof window.showToast === 'function') {
            window.showToast('Toutes les notifications sont marquées comme lues', 'success', 2500);
          }
        };

        window.openFeedComposer = function() {
          window.toggleMobileCreateSheet();
          if (window.location.pathname === '/') {
            const composer = document.getElementById('composer-text');
            if (composer) {
              composer.focus();
              composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            window.location.href = '/?focus=composer';
          }
        };

        // Handle Logout with confirmation
        window.handleLogout = async function() {
          const confirmed = await window.promiseConfirm(
            'Déconnexion de MosaiX',
            'Voulez-vous vraiment clore votre session de travail actuelle ?'
          );
          if (confirmed) {
            window.showToast('Déconnexion réussie. Redirection...', 'success');
            setTimeout(() => {
              window.location.href = '/api/user/switch?role=member';
            }, 600);
          }
        };

        // Theme Mode Toggle (Light/Dark)
        window.toggleThemeMode = function() {
          const html = document.documentElement;
          const current = html.getAttribute('data-theme-mode') || 'dark';
          const nextMode = current === 'dark' ? 'light' : 'dark';
          
          html.setAttribute('data-theme-mode', nextMode);
          if (nextMode === 'dark') {
            html.classList.add('dark');
          } else {
            html.classList.remove('dark');
          }
          
          localStorage.setItem('mosaix_theme_mode', nextMode);
          try {
            fetch('/api/theme?mode=' + nextMode, { method: 'POST' });
          } catch {}
          if (typeof window.showToast === 'function') {
            window.showToast('Thème ' + (nextMode === 'dark' ? 'Sombre' : 'Clair') + ' activé', 'info', 2000);
          }
        };

        // Close dropdowns and modals on click outside or keydown
        document.addEventListener('click', function(e) {
          const menu = document.getElementById('user-menu-dropdown');
          const btn = document.getElementById('user-menu-button');
          if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
              window.setOverlayOpen(menu, btn, false);
            }
          }
        });

        document.addEventListener('keydown', function(e) {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const modal = document.getElementById('command-palette-modal');
            if (modal && !modal.classList.contains('hidden')) {
              window.closeCommandPalette();
            } else {
              window.openCommandPalette();
            }
          } else if (e.key === 'Escape') {
            const menu = document.getElementById('user-menu-dropdown');
            const btn = document.getElementById('user-menu-button');
            if (menu && !menu.classList.contains('hidden')) {
              window.setOverlayOpen(menu, btn, false);
            }
            window.closeCommandPalette();
            window.closeDevInspector();
          }
        });

        // Secondary sidebar live filter
        window.filterSecondarySidebar = function(query) {
          const q = (query || '').toLowerCase().trim();
          const clearBtns = document.querySelectorAll('#secondary-sidebar-filter-clear');
          clearBtns.forEach((clearBtn) => {
            if (q) {
              clearBtn.classList.remove('hidden');
              clearBtn.classList.add('flex');
            } else {
              clearBtn.classList.add('hidden');
              clearBtn.classList.remove('flex');
            }
          });
          const container = document.getElementById('mosaix-slot-shell-sidebar-secondary');
          if (!container) return;
          const items = container.querySelectorAll('.sidebar-nav-item');
          let visibleCount = 0;
          items.forEach(item => {
            const text = (item.getAttribute('data-search') || item.textContent || '').toLowerCase();
            if (!q || text.includes(q)) {
              item.classList.remove('hidden');
              visibleCount++;
            } else {
              item.classList.add('hidden');
            }
          });
          const emptyMsg = document.getElementById('secondary-sidebar-empty-state');
          if (emptyMsg) {
            if (visibleCount === 0 && q) {
              emptyMsg.classList.remove('hidden');
            } else {
              emptyMsg.classList.add('hidden');
            }
          }
        };

        window.clearSecondarySidebarFilter = function() {
          const input = document.getElementById('secondary-sidebar-filter');
          if (input) {
            input.value = '';
            window.filterSecondarySidebar('');
            input.focus();
          }
        };

        // Initialize active locale, presence status, and theme mode
        setTimeout(() => {
          const activeLocale = localStorage.getItem('mosaix_active_locale') || 'fr';
          window.setLocale(activeLocale);

          const savedStatus = localStorage.getItem('mosaix_presence_status') || 'online';
          const presenceSelect = document.getElementById('usermenu-presence-select');
          if (presenceSelect) presenceSelect.value = savedStatus;
          window.updatePresenceStatus(savedStatus);

          const savedTheme = localStorage.getItem('mosaix_theme_mode') || 'dark';
          document.documentElement.setAttribute('data-theme-mode', savedTheme);
          if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }, 50);
      })();
    </script>
  `;
}
