/**
 * @apps/citadelle/domain — Multi-Step Registration Wizard Service
 * FEAT-02: Inscription multi-étapes [CŒUR] (citadelle + ui-runtime)
 */

import * as crypto from "node:crypto";
import type { UserService } from "./user-service.js";
import type { User } from "./user.js";

export interface Step1Credentials {
  email: string;
  password: string;
  displayName: string;
}

export interface Step2Profile {
  accountType: "individual" | "vendor" | "delivery_partner" | "collective";
  organizationName?: string;
  phoneNumber?: string;
  preferredLanguage?: "fr" | "en" | "es";
  sectorActivity?: string;
}

export interface Step3Security {
  enableMfa: boolean;
  recoveryEmail?: string;
  acceptedTerms: boolean;
  optInNewsletter?: boolean;
}

export interface RegistrationDraft {
  draftId: string;
  currentStep: number;
  totalSteps: number;
  step1?: Step1Credentials;
  step2?: Step2Profile;
  step3?: Step3Security;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
  draft?: RegistrationDraft;
}

export class RegistrationWizardService {
  private drafts = new Map<string, RegistrationDraft>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  startRegistration(initialEmail?: string): RegistrationDraft {
    const draftId = `reg_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const draft: RegistrationDraft = {
      draftId,
      currentStep: 1,
      totalSteps: 3,
      step1: initialEmail ? { email: initialEmail, password: "", displayName: "" } : undefined,
      progressPercent: 33,
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(draftId, draft);
    return draft;
  }

  getDraft(draftId: string): RegistrationDraft | null {
    const draft = this.drafts.get(draftId);
    if (!draft) return null;
    return { ...draft };
  }

  saveStep1(draftId: string, data: Step1Credentials): StepValidationResult {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session d'inscription introuvable ou expirée."] };
    }

    const errors: string[] = [];
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("Adresse email invalide.");
    }
    if (!data.password || data.password.length < 8) {
      errors.push("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (!data.displayName || data.displayName.trim().length < 2) {
      errors.push("Le nom d'utilisateur ou pseudonyme doit contenir au moins 2 caractères.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step1 = {
      email: data.email.toLowerCase().trim(),
      password: data.password,
      displayName: data.displayName.trim(),
    };
    draft.currentStep = Math.max(draft.currentStep, 2);
    draft.progressPercent = 66;
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  saveStep2(draftId: string, data: Step2Profile): StepValidationResult {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session d'inscription introuvable ou expirée."] };
    }
    if (!draft.step1) {
      return { valid: false, errors: ["Veuillez d'abord compléter l'étape 1."] };
    }

    const errors: string[] = [];
    if (!["individual", "vendor", "delivery_partner", "collective"].includes(data.accountType)) {
      errors.push("Type de compte non reconnu.");
    }
    if ((data.accountType === "vendor" || data.accountType === "delivery_partner") && !data.organizationName) {
      errors.push("Le nom de l'organisation est obligatoire pour les professionnels et transporteurs.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step2 = { ...data };
    draft.currentStep = Math.max(draft.currentStep, 3);
    draft.progressPercent = 100;
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  saveStep3(draftId: string, data: Step3Security): StepValidationResult {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: ["Session d'inscription introuvable ou expirée."] };
    }
    if (!draft.step1 || !draft.step2) {
      return { valid: false, errors: ["Veuillez compléter les étapes précédentes."] };
    }

    const errors: string[] = [];
    if (!data.acceptedTerms) {
      errors.push("L'acceptation des conditions d'utilisation est obligatoire.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, draft };
    }

    draft.step3 = { ...data };
    draft.updatedAt = new Date().toISOString();

    return { valid: true, errors: [], draft: { ...draft } };
  }

  async finalizeRegistration(
    draftId: string,
    userService: UserService
  ): Promise<{ user: User; draft: RegistrationDraft }> {
    const draft = this.drafts.get(draftId);
    if (!draft || !draft.step1 || !draft.step2 || !draft.step3) {
      throw new Error("L'inscription ne peut pas être finalisée : données incomplètes.");
    }

    if (!draft.step3.acceptedTerms) {
      throw new Error("Les conditions d'utilisation doivent être acceptées.");
    }

    // Determine initial roles based on step2 account type
    const roles = ["citizen"];
    if (draft.step2.accountType === "vendor") {
      roles.push("merchant");
    } else if (draft.step2.accountType === "delivery_partner") {
      roles.push("delivery_partner");
    } else if (draft.step2.accountType === "collective") {
      roles.push("collective_manager");
    }

    const createdUser = await userService.create({
      email: draft.step1.email,
      displayName: draft.step1.displayName,
      roles,
      mfaEnabled: draft.step3.enableMfa,
      emailVerified: false,
    });

    // Clean up draft
    this.drafts.delete(draftId);

    return { user: createdUser, draft };
  }
}

export const registrationWizardService = new RegistrationWizardService();
