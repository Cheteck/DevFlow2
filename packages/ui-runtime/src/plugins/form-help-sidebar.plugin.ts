/**
 * @mosaix/ui-runtime/plugins — Contextual Form Wizard Help Sidebar Plugin
 * FEAT-12: Sidebar aide formulaires [PLUGIN ui] (transversal ui-runtime)
 */

import { escapeHtml } from "@mosaix/support";

export interface FormStepTip {
  step: number;
  title: string;
  description: string;
  requiredFields: string[];
  bestPractices: string[];
  commonMistakes: string[];
}

export interface FormHelpGuide {
  formId: string;
  formName: string;
  steps: FormStepTip[];
}

export const CANONICAL_FORM_HELP_GUIDES: Record<string, FormHelpGuide> = {
  registration_wizard: {
    formId: "registration_wizard",
    formName: "Inscription & Création de Compte",
    steps: [
      {
        step: 1,
        title: "Identifiants & Sécurité Initiale",
        description: "Renseignez votre email principal et un mot de passe robuste d'au moins 8 caractères.",
        requiredFields: ["Adresse email", "Mot de passe", "Nom d'utilisateur"],
        bestPractices: ["Utilisez une adresse email pérenne", "Mélangez chiffres, lettres et symboles"],
        commonMistakes: ["Oublier le format email standard", "Mot de passe trop court (< 8 caractères)"],
      },
      {
        step: 2,
        title: "Profil & Statut d'Activité",
        description: "Choisissez le statut adapté à votre usage (Citoyen, Vendeur, Transporteur ou Collectif).",
        requiredFields: ["Type de compte", "Raison sociale (pour les pros)"],
        bestPractices: ["Renseignez le nom exact de votre structure légale pour accélérer la validation"],
        commonMistakes: ["Sélectionner un compte professionnel sans fournir de raison sociale"],
      },
      {
        step: 3,
        title: "Vérification & Sécurité Avancée",
        description: "Activez l'authentification à deux facteurs (2FA) et validez les conditions de la plateforme.",
        requiredFields: ["Acceptation des Conditions Générales"],
        bestPractices: ["Activer le 2FA dès l'inscription pour protéger vos transactions"],
        commonMistakes: ["Oublier de cocher l'acceptation obligatoire des conditions"],
      },
    ],
  },
  product_creation_wizard: {
    formId: "product_creation_wizard",
    formName: "Ajout de Produit / Vendable",
    steps: [
      {
        step: 1,
        title: "Informations Générales & Catégorisation",
        description: "Définissez le titre attractif, la référence unique et la catégorie du produit.",
        requiredFields: ["Titre du produit", "Référence unique (SKU)", "Catégorie"],
        bestPractices: ["Rédigez un titre clair incluant la spécificité (matière, usage)", "Sélectionnez la catégorie la plus précise"],
        commonMistakes: ["Caractères spéciaux non supportés dans la référence", "Description trop succincte"],
      },
      {
        step: 2,
        title: "Tarification & Gestion des Stocks",
        description: "Indiquez le prix unitaire, la devise et le stock physique réellement disponible.",
        requiredFields: ["Prix de base", "Devise", "Stock initial"],
        bestPractices: ["Définissez un seuil de réapprovisionnement pour recevoir des alertes automatiques"],
        commonMistakes: ["Prix négatif ou nul", "Oublier de renseigner les variantes de taille/couleur"],
      },
      {
        step: 3,
        title: "Visuels & Spécifications Logistiques",
        description: "Ajoutez des photos de haute qualité et le poids pour le calcul des frais d'expédition.",
        requiredFields: ["Photo principale"],
        bestPractices: ["Photos sur fond neutre ou en situation réelle", "Poids précis pour éviter les surcoûts transporteur"],
        commonMistakes: ["Images floues ou liens rompus"],
      },
      {
        step: 4,
        title: "Optimisation SEO & Publication",
        description: "Vérifiez le slug d'URL et décidez de publier immédiatement ou d'enregistrer en brouillon.",
        requiredFields: ["Slug URL"],
        bestPractices: ["Personnalisez le meta-titre pour maximiser votre visibilité sur les moteurs"],
        commonMistakes: ["Laisser le statut en 'Brouillon' si vous souhaitez vendre immédiatement"],
      },
    ],
  },
};

export class FormHelpSidebarPlugin {
  getHelpForStep(formId: string, stepNumber: number): FormStepTip | null {
    const guide = CANONICAL_FORM_HELP_GUIDES[formId];
    if (!guide) return null;
    return guide.steps.find((s) => s.step === stepNumber) || null;
  }

  renderSidebarHtml(formId: string, stepNumber: number): string {
    const tip = this.getHelpForStep(formId, stepNumber);
    if (!tip) return "";

    return `
      <aside class="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 text-xs">
        <div class="flex items-center gap-2 text-primary font-bold">
          <span class="material-symbols-outlined text-lg">help</span>
          <span>Aide & Conseils — Étape ${tip.step}</span>
        </div>
        
        <div>
          <h4 class="font-bold text-on-surface text-sm mb-1">${escapeHtml(tip.title)}</h4>
          <p class="text-on-surface-variant leading-relaxed">${escapeHtml(tip.description)}</p>
        </div>

        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Champs Requis :</span>
          <ul class="list-disc list-inside space-y-1 text-on-surface-variant">
            ${tip.requiredFields.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
        </div>

        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Bonnes Pratiques :</span>
          <ul class="list-disc list-inside space-y-1 text-on-surface-variant">
            ${tip.bestPractices.map((bp) => `<li>${escapeHtml(bp)}</li>`).join("")}
          </ul>
        </div>
      </aside>
    `;
  }
}

export const formHelpSidebarPlugin = new FormHelpSidebarPlugin();
