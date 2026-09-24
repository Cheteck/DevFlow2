import type { BookingSlot } from "../domain/booking.model.js";
import { BookingAnalyticsEngine } from "../domain/booking-portal-resources.js";

export class BookingProviderDashboardView {
  static render(slots: BookingSlot[], providerName: string = "Dr. Martin"): string {
    const stats = BookingAnalyticsEngine.computeStats(slots);

    const rows = slots
      .map(
        (s) => `
      <tr class="border-b border-slate-700/50 hover:bg-slate-800/40">
        <td class="p-3 text-sm text-slate-200 font-mono">${s.id.slice(0, 8)}</td>
        <td class="p-3 text-sm text-slate-200 font-medium">${s.serviceName}</td>
        <td class="p-3 text-sm text-slate-400">${new Date(s.startTime).toLocaleString("fr-FR")}</td>
        <td class="p-3 text-sm text-slate-300 font-mono">${s.price ?? 0} €</td>
        <td class="p-3 text-sm">
          <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
            s.status === "BOOKED"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          }">${s.status}</span>
        </td>
      </tr>`
      )
      .join("");

    return `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-slate-700">
        <div>
          <h2 class="text-xl font-bold text-white tracking-tight">Portail Prestataire — ${providerName}</h2>
          <p class="text-sm text-slate-400">Gestion des créneaux, ressources et métriques de réservations</p>
        </div>
        <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-sm">
          + Nouveau Créneau
        </button>
      </div>

      <!-- KPI Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Créneaux Totaux</span>
          <div class="text-2xl font-bold text-white mt-1">${stats.totalSlots}</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Taux de Remplissage</span>
          <div class="text-2xl font-bold text-emerald-400 mt-1">${Math.round(stats.fillRate * 100)}%</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenu Estimé</span>
          <div class="text-2xl font-bold text-indigo-400 mt-1">${stats.totalRevenue} €</div>
        </div>
        <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Taux No-Show</span>
          <div class="text-2xl font-bold text-amber-400 mt-1">${Math.round(stats.noShowRate * 100)}%</div>
        </div>
      </div>

      <!-- Slots Table -->
      <div class="rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
        <div class="p-4 border-b border-slate-700/60 bg-slate-800/40">
          <h3 class="text-sm font-semibold text-white">Planning & Disponibilités</h3>
        </div>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800/30 text-xs font-semibold uppercase text-slate-400 border-b border-slate-700/60">
              <th class="p-3">ID</th>
              <th class="p-3">Service</th>
              <th class="p-3">Horaires</th>
              <th class="p-3">Tarif</th>
              <th class="p-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="5" class="p-6 text-center text-sm text-slate-500">Aucun créneau configuré.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  }
}
