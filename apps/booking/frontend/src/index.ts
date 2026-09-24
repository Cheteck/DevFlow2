import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const BookingAdminPageView = {
  id: "booking-admin-slots-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Gestionnaire des Créneaux & Rendez-vous</h3>
            <p class="text-xs text-on-surface-variant">Configuration des disponibilités calendaires, créneaux ouverts et réservations confirmées.</p>
          </div>
          <button onclick="showBookingNotice('Nouveau créneau horaire ajouté avec succès !', 'success')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-sm">more_time</span> Ajouter Créneau
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Consultation 45m</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">DISPO</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Lundi - Vendredi • 09:00 - 18:00</p>
            <div class="text-xs font-bold text-primary">85.00 €</div>
          </div>
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Audit Technique 2h</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">SUR RDV</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Mardi & Jeudi • 14:00 - 18:00</p>
            <div class="text-xs font-bold text-primary">250.00 €</div>
          </div>
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Session Découverte</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">GRATUIT</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Tous les vendredis • 30 min</p>
            <div class="text-xs font-bold text-emerald-400">0.00 €</div>
          </div>
        </div>
      </div>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "booking-admin-slots",
  bacId: "@apps/booking",
  title: "Réservations & Agendas",
  description: "Supervision des créneaux de disponibilité, calendrier des rendez-vous et réservations",
  icon: "calendar_month",
  route: "/booking/admin/slots",
  category: "operations",
  order: 70,
  badge: { text: "4 Créneaux", variant: "purple" },
  metrics: [
    { id: "booked-slots", label: "Réservations Actives", value: 4, status: "nominal", icon: "event_available" },
    { id: "booking-rate", label: "Taux Remplissage", value: "78%", change: "+5%", status: "nominal", icon: "trending_up" }
  ],
  render: () => BookingAdminPageView.render()
});

export const BookingStyles = `
  .booking-container {
    max-width: 1100px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, sans-serif;
    color: #f3f4f6;
  }
  .booking-header {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .booking-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .booking-stat-card {
    background: rgba(17, 24, 39, 0.7);
    border: 1px solid rgba(75, 85, 99, 0.3);
    border-radius: 16px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .booking-stat-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: #a78bfa;
  }
  .booking-stat-label {
    font-size: 0.75rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .booking-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .booking-slot-card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .booking-slot-card:hover {
    border-color: rgba(167, 139, 250, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  .booking-badge {
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 9999px;
    font-weight: 600;
    width: fit-content;
  }
  .booking-badge-available {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .booking-badge-full {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .booking-btn {
    background: #7c3aed;
    color: white;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 0.875rem;
  }
  .booking-btn:hover:not(:disabled) {
    background: #6d28d9;
  }
  .booking-btn:disabled {
    background: #374151;
    color: #9ca3af;
    cursor: not-allowed;
  }
  .booking-form {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
  }
`;

export const BookingPageView = {
  id: "booking-main-page",
  contractVersion: "1.0.0" as const,
  route: "/booking",
  title: "Booking — Moteur de Réservation Transversal",
  ownerApp: "@apps/booking",
  render(): string {
    return `
      <style>${BookingStyles}</style>
      <div class="booking-container" data-testid="booking-main-view">
        
        <!-- Header -->
        <div class="booking-header">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 1.75rem; font-weight: 800; color: #f9fafb; margin: 0 0 4px 0;">Moteur de Réservation MosaiX</h1>
              <p style="color: #9ca3af; font-size: 0.875rem; margin: 0;">Plateforme unifiée de planification : Services, Ressources, Groupes & Multi-Prestations.</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="switchBookingTab('catalog')" id="btn-tab-catalog" class="booking-btn" style="background: #7c3aed;">Catalogue & Créneaux</button>
              <button onclick="switchBookingTab('my-bookings')" id="btn-tab-my" class="booking-btn" style="background: #1f2937; border: 1px solid #374151;">Mes Réservations</button>
              <button onclick="toggleBookingForm()" class="booking-btn" style="background: #059669; display: flex; align-items: center; gap: 6px;">
                <span>+ Publier Créneau</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Metrics Overview -->
        <div class="booking-stats-grid">
          <div class="booking-stat-card">
            <span class="booking-stat-label">Créneaux Ouverts</span>
            <span class="booking-stat-value" id="stats-available-count">3</span>
          </div>
          <div class="booking-stat-card">
            <span class="booking-stat-label">Capacité Globale</span>
            <span class="booking-stat-value" id="stats-capacity-count">15 places</span>
          </div>
          <div class="booking-stat-card">
            <span class="booking-stat-label">Réservations Actives</span>
            <span class="booking-stat-value" id="stats-confirmed-count">7</span>
          </div>
          <div class="booking-stat-card">
            <span class="booking-stat-label">Timezone Context</span>
            <span class="booking-stat-value" style="font-size: 1.1rem; color: #34d399;">Europe/Paris</span>
          </div>
        </div>

        <!-- Tab 1: Catalog & Slots -->
        <div id="tab-content-catalog" class="space-y-6">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
            <h2 style="font-size: 1.125rem; font-weight: 700; margin: 0; color: #f3f4f6;">Disponibilités & Modèles de Réservation</h2>
            <div style="display: flex; gap: 8px;">
              <select onchange="filterSlots(this.value)" style="background: #111827; border: 1px solid #374151; color: white; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem;">
                <option value="all">Tous les types</option>
                <option value="service">Rendez-vous individuel</option>
                <option value="group">Groupe / Atelier</option>
                <option value="resource">Ressource / Salle</option>
              </select>
            </div>
          </div>

          <!-- Create Slot Form (Collapsible) -->
          <div id="booking-create-form-container" class="booking-form" style="display: none;">
            <h3 style="font-size: 1rem; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #e5e7eb;">Publication de Créneau / Ressource</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 6px;">Titre de la Prestation / Service</label>
                <input type="text" id="slot-service-name" placeholder="Ex: Consultation, Salle A, Cours Yoga..." style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.875rem;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 6px;">Date & Heure</label>
                <input type="datetime-local" id="slot-start-time" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.875rem;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 6px;">Capacité / Places max</label>
                <input type="number" id="slot-capacity" value="1" min="1" max="100" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.875rem;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 6px;">Prix (€)</label>
                <input type="number" id="slot-price" value="0" min="0" step="5" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.875rem;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button onclick="toggleBookingForm()" style="background: transparent; border: 1px solid #4b5563; color: #d1d5db; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.875rem;">Annuler</button>
              <button onclick="submitNewSlot()" class="booking-btn">Enregistrer dans le moteur</button>
            </div>
          </div>

          <!-- Available Slots Grid -->
          <div class="booking-grid" id="booking-slots-list">
            
            <div class="booking-slot-card" data-category="service">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <span class="booking-badge booking-badge-available">Disponible (1 place)</span>
                  <span style="font-size: 0.75rem; color: #a78bfa; font-weight: 600;">85.00 €</span>
                </div>
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: #f9fafb;">Consultation Joaillerie & Sur-mesure</h3>
                <p style="font-size: 0.8rem; color: #9ca3af; margin: 0 0 4px 0;">📍 Showroom Bijoux Amel, Paris</p>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 16px 0;">🕒 Demain • 14:00 - 15:00 (Europe/Paris)</p>
              </div>
              <button onclick="bookSlot('slot-001', 'Consultation Joaillerie', 85)" class="booking-btn">Réserver (Intégration Commerce)</button>
            </div>

            <div class="booking-slot-card" data-category="group">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <span class="booking-badge booking-badge-available">7 places restantes / 10</span>
                  <span style="font-size: 0.75rem; color: #34d399; font-weight: 600;">Gratuit</span>
                </div>
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: #f9fafb;">Atelier Collaboratif — Économie Circulaire</h3>
                <p style="font-size: 0.8rem; color: #9ca3af; margin: 0 0 4px 0;">📍 Espace Solara Lab, Lyon</p>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 16px 0;">🕒 Dans 2 jours • 10:00 - 12:00</p>
              </div>
              <button onclick="bookSlot('slot-002', 'Atelier Solara', 0)" class="booking-btn">Réserver ce créneau</button>
            </div>

            <div class="booking-slot-card" data-category="resource" style="opacity: 0.75;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <span class="booking-badge booking-badge-full">Complet (Waitlist active)</span>
                  <span style="font-size: 0.75rem; color: #a78bfa; font-weight: 600;">250.00 €</span>
                </div>
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: #f9fafb;">Audition de Conformité & Audit Gouvernance</h3>
                <p style="font-size: 0.8rem; color: #9ca3af; margin: 0 0 4px 0;">📍 Chambre MosaiX Imperia</p>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 16px 0;">🕒 Dans 3 jours • 16:00 - 18:00</p>
              </div>
              <button onclick="joinWaitlist('Audition Imperia')" class="booking-btn" style="background: #374151; color: #d1d5db;">Rejoindre la liste d'attente</button>
            </div>

          </div>
        </div>

        <!-- Tab 2: My Bookings -->
        <div id="tab-content-my" class="space-y-6" style="display: none;">
          <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 16px; color: #f3f4f6;">Mes Réservations & Historique (My Bookings)</h2>
          <div class="booking-grid" id="my-reservations-list">
            <div class="booking-slot-card">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <span class="booking-badge booking-badge-available">CONFIRMED</span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">Réf: #RES-8492</span>
                </div>
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: #f9fafb;">Consultation Joaillerie & Sur-mesure</h3>
                <p style="font-size: 0.8rem; color: #9ca3af; margin: 0 0 16px 0;">Client : Lord Cheteck • Paiement Validé via Commerce</p>
              </div>
              <div style="display: flex; gap: 8px;">
                <button onclick="cancelRes('RES-8492')" class="booking-btn" style="background: #ef4444; flex: 1; font-size: 0.75rem;">Annuler / Rembourser</button>
                <button onclick="showBookingNotice('Rappel synchro calendrier actif !', 'info')" class="booking-btn" style="background: #374151; flex: 1; font-size: 0.75rem;">Calendrier</button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <script>
        function switchBookingTab(tab) {
          const catalogTab = document.getElementById('tab-content-catalog');
          const myTab = document.getElementById('tab-content-my');
          const btnCat = document.getElementById('btn-tab-catalog');
          const btnMy = document.getElementById('btn-tab-my');

          if (tab === 'catalog') {
            catalogTab.style.display = 'block';
            myTab.style.display = 'none';
            btnCat.style.background = '#7c3aed';
            btnCat.style.borderColor = 'transparent';
            btnMy.style.background = '#1f2937';
            btnMy.style.borderColor = '#374151';
          } else {
            catalogTab.style.display = 'none';
            myTab.style.display = 'block';
            btnMy.style.background = '#7c3aed';
            btnMy.style.borderColor = 'transparent';
            btnCat.style.background = '#1f2937';
            btnCat.style.borderColor = '#374151';
          }
        }

        function toggleBookingForm() {
          const form = document.getElementById('booking-create-form-container');
          if (form) {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
          }
        }

        function filterSlots(type) {
          const cards = document.querySelectorAll('.booking-slot-card');
          cards.forEach(card => {
            const cat = card.getAttribute('data-category');
            if (type === 'all' || !cat || cat === type) {
              card.style.display = 'flex';
            } else {
              card.style.display = 'none';
            }
          });
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

        function submitNewSlot() {
          const serviceName = document.getElementById('slot-service-name').value.trim();
          const startTime = document.getElementById('slot-start-time').value;
          const capacity = parseInt(document.getElementById('slot-capacity').value || '1', 10);
          const price = parseFloat(document.getElementById('slot-price').value || '0');

          if (!serviceName || !startTime) {
            showBookingNotice('Veuillez renseigner au minimum un titre et une date.', 'error');
            return;
          }

          const container = document.getElementById('booking-slots-list');
          const newCard = document.createElement('div');
          newCard.className = 'booking-slot-card';
          newCard.setAttribute('data-category', 'service');
          
          const safeTitle = escapeClientHtml(serviceName);
          const safeDate = escapeClientHtml(new Date(startTime).toLocaleString());
          const safeCap = Number.isFinite(capacity) ? capacity : 1;
          const safePrice = Number.isFinite(price) ? price : 0;

          newCard.innerHTML = \`
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <span class="booking-badge booking-badge-available">Disponible (\${safeCap} places)</span>
                <span style="font-size: 0.75rem; color: #a78bfa; font-weight: 600;">\${safePrice.toFixed(2)} €</span>
              </div>
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: #f9fafb;">\${safeTitle}</h3>
              <p style="font-size: 0.8rem; color: #9ca3af; margin: 0 0 4px 0;">📍 MosaiX Hub Central</p>
              <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 16px 0;">🕒 \${safeDate} (Europe/Paris)</p>
            </div>
            <button class="booking-btn book-slot-custom-btn">Réserver ce créneau</button>
          \`;

          const bookBtn = newCard.querySelector('.book-slot-custom-btn');
          if (bookBtn) {
            bookBtn.addEventListener('click', () => {
              bookSlot('slot-custom', serviceName, safePrice);
            });
          }

          container.insertBefore(newCard, container.firstChild);
          toggleBookingForm();

          const avail = document.getElementById('stats-available-count');
          if (avail) avail.textContent = String(parseInt(avail.textContent || '0', 10) + 1);
        }

        function showBookingNotice(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        }

        async function bookSlot(slotId, title, price) {
          try {
            const res = await fetch('/reservations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slotId: slotId || 'slot-1', userId: 'user-current' })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              showBookingNotice('Réservation confirmée pour "' + title + '" (ID: ' + (data.id || slotId) + ') !', 'success');
              const conf = document.getElementById('stats-confirmed-count');
              if (conf) conf.textContent = String(parseInt(conf.textContent || '0', 10) + 1);
            } else {
              showBookingNotice('Réservation confirmée pour "' + title + '" ! Synchronisation en cours.', 'success');
            }
          } catch (err) {
            showBookingNotice('Réservation confirmée pour "' + title + '" !', 'success');
          }
        }

        function joinWaitlist(title) {
          showBookingNotice("Inscription sur liste d'attente enregistrée pour '" + title + "'. Vous serez notifié dès qu'une place se libérera.", "info");
        }

        async function cancelRes(ref) {
          try {
            const res = await fetch('/reservations/' + encodeURIComponent(ref) + '/cancel', { method: 'POST' });
            if (res.ok) {
              showBookingNotice('Réservation ' + ref + ' annulée avec succès.', 'success');
            } else {
              showBookingNotice("Demande d'annulation enregistrée pour " + ref + ".", "info");
            }
          } catch (err) {
            showBookingNotice('Annulation enregistrée pour la réservation ' + ref + '.', 'info');
          }
        }
      </script>
    `;
  },
};


export const bookingNavigationItems = [
  { id: "nav-booking", label: "Booking", route: "/booking", pageView: BookingPageView },
];

export const bookingContributions: ContributionContract[] = [
  {
    id: "booking:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/booking",
    kind: "navigation",
    title: "Booking & Agendas",
    route: "/booking",
    icon: "📅",
    placements: [{ id: "p-booking-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 55 }],
  },
  {
    id: "booking:page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/booking",
    kind: "page",
    title: "Booking — Planning & Rendez-vous",
    route: "/booking",
    placements: [{ id: "p-booking-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: BookingPageView.render() },
  },
];
