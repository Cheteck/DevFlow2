/**
 * @apps/portfolio/domain — Multi-Step Product/Vendable Creation Wizard
 * FEAT-03: Ajout produit multi-étapes [CŒUR] (portfolio + ui-runtime)
 */

import * as crypto from "node:crypto";
import type { Vendable, VendableType, WorkflowStatus } from "./vendable.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface ProductStep1Identity {
  name: string;
  reference: string;
  type: VendableType;
  category: string;
  description: string;
  tags: string[];
  brand?: string;
  language?: string;
}

export interface ProductVariantInput {
  name: string;
  sku: string;
  priceModifier?: number;
  stock: number;
  attributes?: Record<string, string>;
}

export interface ProductStep2Pricing {
  basePrice: number;
  currency: string;
  sku: string;
  stock: number;
  reorderPoint?: number;
  taxClass?: string;
  variants: ProductVariantInput[];
}

export interface ProductStep3Media {
  mediaUrls: string[];
  primaryImageUrl?: string;
  weightGrams?: number;
  dimensions?: { width: number; height: number; depth: number; unit: "cm" | "mm" };
  characteristics?: Record<string, unknown>;
}

export interface ProductStep4SeoAndPublish {
  slug: string;
  metaTitle?: string;
  metaDesc?: string;
  targetStatus: WorkflowStatus;
  spaceId?: string;
}

export interface ProductWizardDraft {
  draftId: string;
  vendorId?: string;
  spaceId?: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  step1?: ProductStep1Identity;
  step2?: ProductStep2Pricing;
  step3?: ProductStep3Media;
  step4?: ProductStep4SeoAndPublish;
  createdAt: string;
  updatedAt: string;
}

export interface WizardStepResult {
  valid: boolean;
  errors: string[];
  draft?: ProductWizardDraft;
}

export class ProductWizardService {
  private activeDrafts = new Map<string, ProductWizardDraft>();

  startDraft(vendorId?: string, spaceId?: string): ProductWizardDraft {
    const draftId = `draft_prod_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const draft: ProductWizardDraft = {
      draftId,
      vendorId,
      spaceId,
      currentStep: 1,
      totalSteps: 4,
      progressPercent: 25,
      createdAt: now,
      updatedAt: now,
    };
    this.activeDrafts.set(draftId, draft);
    return draft;
  }

  getDraft(draftId: string): ProductWizardDraft | null {
    const draft = this.activeDrafts.get(draftId);
    if (!draft) return null;
    return { ...draft };
  }

  listDrafts(vendorId?: string): ProductWizardDraft[] {
    const all = Array.from(this.activeDrafts.values());
    if (vendorId) {
      return all.filter((d) => d.vendorId === vendorId);
    }
    return all;
  }

  saveStep1(draftId: string, data: ProductStep1Identity): WizardStepResult {
    const draft = this.activeDrafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session de création de produit introuvable ou expirée."] };
    }

    const errors: string[] = [];
    if (!data.name || data.name.trim().length < 2) {
      errors.push("Le nom du produit doit contenir au moins 2 caractères.");
    }
    if (!data.reference || !/^[A-Za-z0-9-_]+$/.test(data.reference)) {
      errors.push("La référence doit contenir uniquement des lettres, chiffres, tirets et underscores.");
    }
    if (!data.category || data.category.trim().length === 0) {
      errors.push("La catégorie est obligatoire.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step1 = {
      ...data,
      name: data.name.trim(),
      reference: data.reference.trim(),
      category: data.category.trim(),
      language: data.language || "fr",
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
    draft.currentStep = Math.max(draft.currentStep, 2);
    draft.progressPercent = 50;
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  saveStep2(draftId: string, data: ProductStep2Pricing): WizardStepResult {
    const draft = this.activeDrafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session introuvable."] };
    }
    if (!draft.step1) {
      return { valid: false, errors: ["Veuillez compléter l'étape 1."] };
    }

    const errors: string[] = [];
    if (typeof data.basePrice !== "number" || isNaN(data.basePrice) || data.basePrice < 0) {
      errors.push("Le prix de base doit être un nombre positif ou nul.");
    }
    if (!data.currency || data.currency.length !== 3) {
      errors.push("Code devise invalide (ex: EUR, USD, XOF).");
    }
    if (typeof data.stock !== "number" || isNaN(data.stock) || data.stock < 0) {
      errors.push("Le stock initial doit être un nombre entier positif ou nul.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step2 = {
      ...data,
      variants: Array.isArray(data.variants) ? data.variants : [],
    };
    draft.currentStep = Math.max(draft.currentStep, 3);
    draft.progressPercent = 75;
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  saveStep3(draftId: string, data: ProductStep3Media): WizardStepResult {
    const draft = this.activeDrafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session introuvable."] };
    }
    if (!draft.step1 || !draft.step2) {
      return { valid: false, errors: ["Veuillez compléter les étapes 1 et 2."] };
    }

    draft.step3 = {
      mediaUrls: Array.isArray(data.mediaUrls) ? data.mediaUrls : [],
      primaryImageUrl: data.primaryImageUrl || (data.mediaUrls && data.mediaUrls[0]),
      weightGrams: data.weightGrams,
      dimensions: data.dimensions,
      characteristics: data.characteristics || {},
    };
    draft.currentStep = Math.max(draft.currentStep, 4);
    draft.progressPercent = 100;
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  saveStep4(draftId: string, data: ProductStep4SeoAndPublish): WizardStepResult {
    const draft = this.activeDrafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session introuvable."] };
    }
    if (!draft.step1 || !draft.step2 || !draft.step3) {
      return { valid: false, errors: ["Veuillez compléter toutes les étapes précédentes."] };
    }

    const errors: string[] = [];
    const generatedSlug = data.slug || draft.step1.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!generatedSlug) {
      errors.push("Le slug SEO ne peut pas être vide.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step4 = {
      ...data,
      slug: generatedSlug,
      targetStatus: data.targetStatus || "Published",
    };
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  async finalizeAndPublish(
    draftId: string,
    portfolioService: PortfolioService
  ): Promise<Vendable> {
    const draft = this.activeDrafts.get(draftId);
    if (!draft || !draft.step1 || !draft.step2 || !draft.step3 || !draft.step4) {
      throw new Error("Impossible de publier : toutes les étapes du wizard doivent être complétées.");
    }

    const id = `vendable_${crypto.randomUUID()}`;
    const lang = draft.step1.language || "fr";

    const vendable: Vendable = {
      identity: {
        id,
        reference: draft.step1.reference,
        type: draft.step1.type,
        status: draft.step4.targetStatus,
      },
      pricing: {
        basePrice: draft.step2.basePrice,
        currency: draft.step2.currency,
        taxClass: draft.step2.taxClass,
      },
      inventory: {
        sku: draft.step2.sku || draft.step1.reference,
        stock: draft.step2.stock,
        reserved: 0,
        reorderPoint: draft.step2.reorderPoint || 5,
      },
      seo: {
        slug: draft.step4.slug,
        metaTitle: draft.step4.metaTitle || draft.step1.name,
        metaDesc: draft.step4.metaDesc || draft.step1.description,
      },
      content: {
        [lang]: {
          name: draft.step1.name,
          description: draft.step1.description,
          keywords: draft.step1.tags,
        },
      },
      classification: {
        categories: [draft.step1.category],
        tags: draft.step1.tags,
        brand: draft.step1.brand,
      },
      characteristics: {
        physical: draft.step3.weightGrams
          ? {
              weight: draft.step3.weightGrams,
              dimensions: draft.step3.dimensions,
            }
          : undefined,
        custom: draft.step3.characteristics,
      },
      media: {
        images: draft.step3.mediaUrls.map((url, idx) => ({
          url,
          role: idx === 0 ? "primary" : "gallery",
          order: idx,
        })),
      },
      variants: draft.step2.variants.map((v) => ({
        id: `var_${crypto.randomUUID()}`,
        reference: v.sku,
        name: v.name,
        pricing: {
          basePrice: draft.step2!.basePrice + (v.priceModifier || 0),
          currency: draft.step2!.currency,
        },
        inventory: {
          sku: v.sku,
          stock: v.stock,
          reserved: 0,
          reorderPoint: 2,
        },
        characteristics: v.attributes,
      })),
      metadata: {
        vendorId: draft.vendorId,
        spaceId: draft.spaceId || draft.step4.spaceId,
        wizardCompletedAt: new Date().toISOString(),
      },
    };

    const saved = await portfolioService.create(vendable);

    // Delete draft after publication
    this.activeDrafts.delete(draftId);

    return saved;
  }
}

export const productWizardService = new ProductWizardService();
