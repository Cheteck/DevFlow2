/**
 * @apps/spaces/domain — Space Business Registry & Verification Service
 * FEAT-10: Registre de commerce [CŒUR] (spaces + citadelle/imperia)
 */

import * as crypto from "node:crypto";

export type BusinessVerificationStatus =
  | "unverified"
  | "pending_review"
  | "verified"
  | "rejected"
  | "revoked";

export interface BusinessVerificationDocument {
  id: string;
  type: "kbis_extract" | "tax_certificate" | "manager_id" | "bank_rib" | "other";
  documentName: string;
  documentUrl: string;
  uploadedAt: string;
  sha256Checksum?: string;
}

export interface SpaceBusinessProfile {
  spaceId: string;
  legalEntityName: string;
  registrationNumber: string; // SIRET / Trade Registry Number (RCS)
  vatNumber?: string;
  registeredAddress: string;
  registeredCity: string;
  registeredCountry: string;
  managerFullName: string;
  status: BusinessVerificationStatus;
  documents: BusinessVerificationDocument[];
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  revocationReason?: string;
  verifiedBadgeLabel?: string;
  updatedAt: string;
}

export interface SubmitBusinessVerificationInput {
  spaceId: string;
  legalEntityName: string;
  registrationNumber: string;
  vatNumber?: string;
  registeredAddress: string;
  registeredCity: string;
  registeredCountry?: string;
  managerFullName: string;
  documents: Array<{
    type: BusinessVerificationDocument["type"];
    documentName: string;
    documentUrl: string;
    sha256Checksum?: string;
  }>;
}

export class SpaceBusinessRegistryService {
  private profiles = new Map<string, SpaceBusinessProfile>();

  getProfile(spaceId: string): SpaceBusinessProfile | null {
    const p = this.profiles.get(spaceId);
    return p ? { ...p } : null;
  }

  submitForVerification(input: SubmitBusinessVerificationInput): SpaceBusinessProfile {
    if (!input.legalEntityName || input.legalEntityName.trim().length < 2) {
      throw new Error("La raison sociale de l'entreprise est obligatoire.");
    }
    if (!input.registrationNumber || input.registrationNumber.trim().length < 4) {
      throw new Error("Le numéro d'immatriculation / registre de commerce est obligatoire.");
    }
    if (!input.documents || input.documents.length === 0) {
      throw new Error("Au moins un justificatif (ex: extrait Kbis ou registre légal) est obligatoire.");
    }

    const now = new Date().toISOString();
    const docs: BusinessVerificationDocument[] = input.documents.map((d) => ({
      id: `doc_${crypto.randomUUID()}`,
      type: d.type,
      documentName: d.documentName,
      documentUrl: d.documentUrl,
      uploadedAt: now,
      sha256Checksum: d.sha256Checksum,
    }));

    const profile: SpaceBusinessProfile = {
      spaceId: input.spaceId,
      legalEntityName: input.legalEntityName.trim(),
      registrationNumber: input.registrationNumber.trim(),
      vatNumber: input.vatNumber?.trim(),
      registeredAddress: input.registeredAddress.trim(),
      registeredCity: input.registeredCity.trim(),
      registeredCountry: input.registeredCountry?.trim() || "FR",
      managerFullName: input.managerFullName.trim(),
      status: "pending_review",
      documents: docs,
      submittedAt: now,
      updatedAt: now,
    };

    this.profiles.set(input.spaceId, profile);
    return { ...profile };
  }

  verifySpace(spaceId: string, adminUserId: string, badgeLabel = "Entreprise Vérifiée"): SpaceBusinessProfile {
    const profile = this.profiles.get(spaceId);
    if (!profile) {
      throw new Error("Dossier de registre de commerce introuvable.");
    }

    profile.status = "verified";
    profile.verifiedAt = new Date().toISOString();
    profile.verifiedBy = adminUserId;
    profile.verifiedBadgeLabel = badgeLabel;
    profile.rejectionReason = undefined;
    profile.revocationReason = undefined;
    profile.updatedAt = new Date().toISOString();

    return { ...profile };
  }

  rejectSpace(spaceId: string, adminUserId: string, reason: string): SpaceBusinessProfile {
    const profile = this.profiles.get(spaceId);
    if (!profile) {
      throw new Error("Dossier de registre de commerce introuvable.");
    }

    profile.status = "rejected";
    profile.verifiedBy = adminUserId;
    profile.rejectionReason = reason;
    profile.updatedAt = new Date().toISOString();

    return { ...profile };
  }

  revokeVerification(spaceId: string, adminUserId: string, reason: string): SpaceBusinessProfile {
    const profile = this.profiles.get(spaceId);
    if (!profile) {
      throw new Error("Dossier introuvable.");
    }

    profile.status = "revoked";
    profile.verifiedBy = adminUserId;
    profile.revocationReason = reason;
    profile.updatedAt = new Date().toISOString();

    return { ...profile };
  }

  listProfiles(filter?: { status?: BusinessVerificationStatus }): SpaceBusinessProfile[] {
    const list = Array.from(this.profiles.values());
    if (filter?.status) {
      return list.filter((p) => p.status === filter.status);
    }
    return list;
  }

  isSpaceVerified(spaceId: string): boolean {
    const p = this.profiles.get(spaceId);
    return p ? p.status === "verified" : false;
  }
}

export const spaceBusinessRegistryService = new SpaceBusinessRegistryService();
