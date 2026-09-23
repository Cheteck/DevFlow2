export interface SubscriptionContribution {
  id: string;
  type: string;
  title: string;
  render: () => string;
}

export const subscriptionContributions: SubscriptionContribution[] = [
  {
    id: "subscription:widget:plans",
    type: "widget",
    title: "Offres & Forfaits",
    render: () => `
      <div class="p-5 rounded-2xl bg-surface-container/60 border border-outline-variant/30 space-y-4 backdrop-blur-md">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">💳</span>
            <h3 class="text-sm font-bold text-on-surface">Forfaits MosaiX</h3>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">Phase 23</span>
        </div>
        <p class="text-xs text-on-surface-variant">Accédez aux fonctionnalités exclusives, boutiques illimitées et plan de contrôle avancé.</p>
        <a href="/subscription" class="block w-full py-2 text-center rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs transition shadow-sm">
          Voir les forfaits & abonnements
        </a>
      </div>
    `,
  },
];

export function SubscriptionPageView(): string {
  return `
    <div class="space-y-8 animate-fade-in">
      <!-- Header -->
      <div class="p-8 rounded-3xl bg-gradient-to-r from-primary/20 via-surface-container to-surface-container/40 border border-outline-variant/30 backdrop-blur-xl relative overflow-hidden">
        <div class="max-w-2xl space-y-3 relative z-10">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold">
            <span>💳</span> Abonnements & Facturation Récurrente
          </div>
          <h1 class="text-3xl font-extrabold text-on-surface tracking-tight">Tarification Simple & Modulaire</h1>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            Choisissez l'offre adaptée à votre communauté ou votre organisation. Activez instantanément les fonctionnalités à travers tous vos espaces et BACS.
          </p>
        </div>
      </div>

      <!-- Pricing Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Free Tier -->
        <div class="p-6 rounded-3xl bg-surface-container/60 border border-outline-variant/30 flex flex-col justify-between space-y-6 hover:border-outline-variant/60 transition shadow-sm">
          <div class="space-y-4">
            <div class="space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Gratuit</span>
              <h3 class="text-xl font-bold text-on-surface">Community Starter</h3>
              <p class="text-xs text-on-surface-variant">Idéal pour démarrer et participer aux espaces publics.</p>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-extrabold text-on-surface">0€</span>
              <span class="text-xs text-on-surface-variant">/ mois</span>
            </div>
            <ul class="space-y-2.5 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> 1 Espace communautaire</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Fil d'actualité Solara</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Messagerie instantanée Beam</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Entraide Solidarity</li>
            </ul>
          </div>
          <button class="w-full py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-variant/40 text-on-surface font-bold text-xs transition cursor-default">
            Plan Actuel (Inclus)
          </button>
        </div>

        <!-- Pro Tier (Highlighted) -->
        <div class="p-6 rounded-3xl bg-gradient-to-b from-primary/20 via-surface-container to-surface-container border-2 border-primary flex flex-col justify-between space-y-6 relative shadow-lg">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-on-primary text-[11px] font-bold shadow-md">
            ⭐ Plus Populaire
          </div>
          <div class="space-y-4">
            <div class="space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-primary">Créateurs & Marchands</span>
              <h3 class="text-xl font-bold text-on-surface">Pro Créateur</h3>
              <p class="text-xs text-on-surface-variant">Pour les marchands, créateurs et collectifs actifs.</p>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-extrabold text-on-surface">29€</span>
              <span class="text-xs text-on-surface-variant">/ mois</span>
            </div>
            <ul class="space-y-2.5 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
              <li class="flex items-center gap-2"><span class="text-primary font-bold">✓</span> Espaces et canaux illimités</li>
              <li class="flex items-center gap-2"><span class="text-primary font-bold">✓</span> Boutique Commerce & Catalogue Portfolio</li>
              <li class="flex items-center gap-2"><span class="text-primary font-bold">✓</span> Réservations & Créneaux Booking</li>
              <li class="flex items-center gap-2"><span class="text-primary font-bold">✓</span> Support prioritaire 7j/7</li>
            </ul>
          </div>
          <button onclick="alert('Activation du forfait Pro Créateur simulée avec succès.')" class="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs transition shadow-md cursor-pointer">
            Passer à l'offre Pro
          </button>
        </div>

        <!-- Enterprise Tier -->
        <div class="p-6 rounded-3xl bg-surface-container/60 border border-outline-variant/30 flex flex-col justify-between space-y-6 hover:border-outline-variant/60 transition shadow-sm">
          <div class="space-y-4">
            <div class="space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Organisations</span>
              <h3 class="text-xl font-bold text-on-surface">Fédération Imperia</h3>
              <p class="text-xs text-on-surface-variant">Gouvernance centralisée, multi-tenancy et résilience.</p>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-extrabold text-on-surface">99€</span>
              <span class="text-xs text-on-surface-variant">/ mois</span>
            </div>
            <ul class="space-y-2.5 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Plan de contrôle Imperia & Topologie</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Circuit Breakers & Rejeu DLQ</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Audit log étendu 365 jours</li>
              <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Multi-tenancy et isolation dédiée</li>
            </ul>
          </div>
          <button onclick="alert('Demande de forfait Entreprise transmise au support de gouvernance.')" class="w-full py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-variant/40 text-on-surface font-bold text-xs transition cursor-pointer">
            Contacter pour Entreprise
          </button>
        </div>
      </div>
    </div>
  `;
}
