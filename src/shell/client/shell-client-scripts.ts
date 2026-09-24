/**
 * @shell/client — Central Client-Side Shell Scripts
 * Provides unified toast, dialogs, localization, theme, user/space switcher, and search.
 */

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
            if (res.ok) window.location.reload();
          } catch {
            window.location.reload();
          }
        };

        window.switchActiveSpace = async function(spaceId) {
          try {
            await fetch('/api/space/switch?spaceId=' + encodeURIComponent(spaceId || ''), { method: 'POST' });
            window.location.reload();
          } catch {
            window.location.reload();
          }
        };

        window.toggleUserDropdown = function() {
          const menu = document.getElementById('user-menu-dropdown');
          if (menu) menu.classList.toggle('hidden');
        };

        window.toggleMobileDrawer = function() {
          const drawer = document.getElementById('mobile-drawer');
          if (drawer) drawer.classList.toggle('hidden');
        };

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
          const menu = document.getElementById('user-menu-dropdown');
          const btn = document.getElementById('user-menu-button');
          if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
          }
        });

        // Initialize active locale
        setTimeout(() => {
          const activeLocale = localStorage.getItem('mosaix_active_locale') || 'fr';
          window.setLocale(activeLocale);
        }, 50);
      })();
    </script>
  `;
}
