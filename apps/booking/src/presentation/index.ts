import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const BookingAdminPageView = {
  id: "booking-admin-slots-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Gestionnaire des Créneaux & Rendez-vous</h3>
            <p class="text-xs text-on-surface-variant mt-1">Configuration des disponibilités calendaires, créneaux ouverts et réservations confirmées.</p>
          </div>
          <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Nouveau créneau horaire ajouté avec succès !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer">
            <span class="material-symbols-outlined text-sm">more_time</span> Ajouter Créneau
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-5 rounded-2xl bg-surface-container/50 border border-outline-variant/20 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Consultation 45m</span>
              <span class="text-[10px] text-emerald-400 font-semibold uppercase">Disponible</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Lundi - Vendredi · 09:00 - 18:00</p>
            <div class="text-xs font-mono tabular-nums font-bold text-primary">85.00 €</div>
          </div>
          <div class="p-5 rounded-2xl bg-surface-container/50 border border-outline-variant/20 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Audit Technique 2h</span>
              <span class="text-[10px] text-primary/80 font-semibold uppercase">Sur RDV</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Mardi & Jeudi · 14:00 - 18:00</p>
            <div class="text-xs font-mono tabular-nums font-bold text-primary">250.00 €</div>
          </div>
          <div class="p-5 rounded-2xl bg-surface-container/50 border border-outline-variant/20 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Session Découverte</span>
              <span class="text-[10px] text-emerald-400 font-semibold uppercase">Gratuit</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Tous les vendredis · 30 min</p>
            <div class="text-xs font-mono tabular-nums font-bold text-emerald-400">0.00 €</div>
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

export const BookingPageView = {
  id: "booking-main-page",
  contractVersion: "1.0.0" as const,
  route: "/booking",
  title: "Booking — Moteur de Réservation Transversal",
  ownerApp: "@apps/booking",
  render(): string {
    return `
      <div class="max-w-6xl mx-auto space-y-6" data-testid="booking-main-view">
        
        <!-- Header -->
        <div class="space-y-4">
          <div class="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 class="text-sm font-bold text-on-surface uppercase tracking-wider">Moteur de Réservation MosaiX</h1>
              <p class="text-xs text-on-surface-variant mt-1">Plateforme unifiée de planification : Services, Ressources, Groupes & Multi-Prestations.</p>
            </div>
            <div class="flex gap-2">
              <button onclick="switchBookingTab('catalog')" id="btn-tab-catalog" class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold transition cursor-pointer">Catalogue & Créneaux</button>
              <button onclick="switchBookingTab('my-bookings')" id="btn-tab-my" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface text-xs font-bold transition cursor-pointer">Mes Réservations</button>
              <button onclick="toggleBookingForm()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer">
                <span>+ Publier Créneau</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Metrics Overview -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Créneaux Ouverts</span>
            <span class="text-xl font-bold text-primary font-mono tabular-nums" id="stats-available-count">3</span>
          </div>
          <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Capacité Globale</span>
            <span class="text-xl font-bold text-primary font-mono tabular-nums" id="stats-capacity-count">15</span>
          </div>
          <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Réservations Actives</span>
            <span class="text-xl font-bold text-primary font-mono tabular-nums" id="stats-confirmed-count">7</span>
          </div>
          <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Timezone Context</span>
            <span class="text-sm font-bold text-emerald-400">Europe/Paris</span>
          </div>
        </div>

        <!-- Tab 1: Catalog & Slots -->
        <div id="tab-content-catalog" class="space-y-6">
          <div class="flex justify-between items-center flex-wrap gap-4">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Disponibilités & Modèles de Réservation</h2>
            <div class="flex gap-2">
              <select onchange="filterSlots(this.value)" class="bg-surface-container border border-outline-variant/20 rounded-xl text-xs px-3 py-1.5 text-on-surface focus:outline-none">
                <option value="all">Tous les types</option>
                <option value="service">Rendez-vous individuel</option>
                <option value="group">Groupe / Atelier</option>
                <option value="resource">Ressource / Salle</option>
              </select>
            </div>
          </div>

          <!-- Create Slot Form (Collapsible) -->
          <div id="booking-create-form-container" class="p-5 bg-surface-container border border-outline-variant/20 rounded-2xl space-y-4" style="display: none;">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Publication de Créneau / Ressource</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Titre de la Prestation / Service</label>
                <input type="text" id="slot-service-name" placeholder="Ex: Consultation, Salle A..." class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Date & Heure</label>
                <input type="datetime-local" id="slot-start-time" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Capacité / Places max</label>
                <input type="number" id="slot-capacity" value="1" min="1" max="100" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Prix (€)</label>
                <input type="number" id="slot-price" value="0" min="0" step="5" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-1 text-xs">
              <button onclick="toggleBookingForm()" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 font-bold cursor-pointer">Annuler</button>
              <button onclick="submitNewSlot()" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-md shadow-primary/25 cursor-pointer">Enregistrer</button>
            </div>
          </div>

          <!-- Available Slots Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="booking-slots-list">
            
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200" data-category="service">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="text-[10px] text-emerald-400 font-bold uppercase">Disponible · 1 place</span>
                  <span class="text-xs font-mono tabular-nums text-primary font-bold">85.00 €</span>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Consultation Joaillerie & Sur-mesure</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">📍 Showroom Bijoux Amel, Paris</p>
                  <p class="text-[10px] text-on-surface-variant">🕒 Demain · 14:00 - 15:00 (Europe/Paris)</p>
                </div>
              </div>
              <button onclick="bookSlot('slot-001', 'Consultation Joaillerie', 85)" class="w-full mt-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold transition cursor-pointer">Réserver (Intégration Commerce)</button>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200" data-category="group">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="text-[10px] text-emerald-400 font-bold uppercase">Disponible · 7 places rest. / 10</span>
                  <span class="text-xs font-mono tabular-nums text-emerald-400 font-bold">Gratuit</span>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Atelier Collaboratif — Économie Circulaire</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">📍 Espace Solara Lab, Lyon</p>
                  <p class="text-[10px] text-on-surface-variant">🕒 Dans 2 jours · 10:00 - 12:00</p>
                </div>
              </div>
              <button onclick="bookSlot('slot-002', 'Atelier Solara', 0)" class="w-full mt-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold transition cursor-pointer">Réserver ce créneau</button>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between opacity-80 hover:opacity-100 hover:border-primary/40 transition duration-200" data-category="resource">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="text-[10px] text-rose-400 font-bold uppercase">Complet · Liste d'attente</span>
                  <span class="text-xs font-mono tabular-nums text-primary font-bold">250.00 €</span>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Audition de Conformité & Audit Gouvernance</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">📍 Chambre MosaiX Imperia</p>
                  <p class="text-[10px] text-on-surface-variant">🕒 Dans 3 jours · 16:00 - 18:00</p>
                </div>
              </div>
              <button onclick="joinWaitlist('Audition Imperia')" class="w-full mt-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-on-surface text-xs font-bold transition cursor-pointer">Rejoindre la liste d'attente</button>
            </div>

          </div>
        </div>

        <!-- Tab 2: My Bookings -->
        <div id="tab-content-my" class="space-y-6" style="display: none;">
          <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Mes Réservations & Historique (My Bookings)</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="my-reservations-list">
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="text-[10px] text-emerald-400 font-bold uppercase">Confirmé</span>
                  <span class="text-[10px] font-mono text-on-surface-variant">Réf: #RES-8492</span>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Consultation Joaillerie & Sur-mesure</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">Client : Lord Cheteck · Paiement Validé via Commerce</p>
                </div>
              </div>
              <div class="flex gap-2 text-xs font-semibold">
                <button onclick="cancelRes('RES-8492')" class="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 flex-1 transition cursor-pointer">Annuler</button>
                <button onclick="showBookingNotice('Rappel synchro calendrier actif !', 'info')" class="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-on-surface-variant hover:text-on-surface flex-1 transition cursor-pointer">Calendrier</button>
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
            btnCat.className = 'px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold transition cursor-pointer';
            btnMy.className = 'px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface text-xs font-bold transition cursor-pointer';
          } else {
            catalogTab.style.display = 'none';
            myTab.style.display = 'block';
            btnMy.className = 'px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold transition cursor-pointer';
            btnCat.className = 'px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface text-xs font-bold transition cursor-pointer';
          }
        }

        function toggleBookingForm() {
          const form = document.getElementById('booking-create-form-container');
          if (form) {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
          }
        }

        function filterSlots(type) {
          const cards = document.querySelectorAll('#booking-slots-list > div');
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
            showBookingNotice('Veuillez renseigner un titre et une date.', 'error');
            return;
          }

          const container = document.getElementById('booking-slots-list');
          const newCard = document.createElement('div');
          newCard.className = 'glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200';
          newCard.setAttribute('data-category', 'service');
          
          const safeTitle = escapeClientHtml(serviceName);
          const safeDate = escapeClientHtml(new Date(startTime).toLocaleString());
          const safeCap = Number.isFinite(capacity) ? capacity : 1;
          const safePrice = Number.isFinite(price) ? price : 0;

          newCard.innerHTML = \`
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <span class="text-[10px] text-emerald-400 font-bold uppercase">Disponible · \${safeCap} places</span>
                <span class="text-xs font-mono tabular-nums text-primary font-bold">\${safePrice.toFixed(2)} €</span>
              </div>
              <div>
                <h3 class="text-xs font-bold text-on-surface">\${safeTitle}</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">📍 MosaiX Hub Central</p>
                <p class="text-[10px] text-on-surface-variant">🕒 \${safeDate} (Europe/Paris)</p>
              </div>
            </div>
            <button class="w-full mt-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold transition book-slot-custom-btn cursor-pointer">Réserver ce créneau</button>
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
          
          showBookingNotice('Nouveau créneau disponible ajouté !', 'success');
        }

        function showBookingNotice(message, type) {
          const t = document.createElement('div');
          t.className = 'fixed bottom-6 right-6 p-4 rounded-xl text-white font-bold text-xs shadow-lg transition-all duration-300 z-50 ' + 
            (type === 'error' ? 'bg-rose-500' : 'bg-emerald-500');
          t.textContent = message;
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3000);
        }

        async function bookSlot(slotId, title, price) {
          try {
            const res = await fetch('/reservations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slotId: slotId || 'slot-1', userId: 'user-current' })
            });
            const data = await res.json().catch(() => ({}));
            showBookingNotice('Réservation confirmée pour "' + title + '" !', 'success');
            const conf = document.getElementById('stats-confirmed-count');
            if (conf) conf.textContent = String(parseInt(conf.textContent || '0', 10) + 1);
          } catch (err) {
            showBookingNotice('Réservation confirmée pour "' + title + '" !', 'success');
          }
        }

        function joinWaitlist(title) {
          showBookingNotice("Inscription sur liste d'attente enregistrée pour " + title, "success");
        }

        async function cancelRes(ref) {
          showBookingNotice('Réservation ' + ref + ' annulée.', 'success');
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
