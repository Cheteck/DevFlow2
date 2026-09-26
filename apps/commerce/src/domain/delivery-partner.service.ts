/**
 * @apps/commerce/domain — Delivery Partner & Logistics Carrier Service
 * FEAT-05: Comptes sociétés de livraison [CŒUR] (citadelle + commerce + spaces)
 */

import * as crypto from "node:crypto";

export type DeliveryPartnerStatus = "pending_verification" | "verified" | "suspended" | "rejected";

export type ShipmentStatus =
  | "created"
  | "assigned"
  | "pickup_pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed_attempt"
  | "returned";

export interface DeliveryPartnerProfile {
  id: string;
  userId: string;
  spaceId?: string;
  companyName: string;
  legalRegistrationNumber: string; // SIRET / Trade Registry
  vatNumber?: string;
  contactEmail: string;
  contactPhone: string;
  fleetSize: number;
  coverageZones: string[];
  vehicleTypes: Array<"bike" | "motorcycle" | "car" | "van" | "truck">;
  status: DeliveryPartnerStatus;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  sellerId: string;
  sellerSpaceId?: string;
  partnerId: string;
  trackingNumber: string;
  carrierName: string;
  recipientName: string;
  shippingAddress: string;
  shippingCity: string;
  status: ShipmentStatus;
  statusHistory: Array<{ status: ShipmentStatus; timestamp: string; location?: string; comment?: string }>;
  estimatedDeliveryDate?: string;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDeliveryPartnerInput {
  userId: string;
  spaceId?: string;
  companyName: string;
  legalRegistrationNumber: string;
  vatNumber?: string;
  contactEmail: string;
  contactPhone: string;
  fleetSize?: number;
  coverageZones?: string[];
  vehicleTypes?: Array<"bike" | "motorcycle" | "car" | "van" | "truck">;
}

export class DeliveryPartnerService {
  private partners = new Map<string, DeliveryPartnerProfile>();
  private shipments = new Map<string, ShipmentRecord>();

  registerPartner(input: RegisterDeliveryPartnerInput): DeliveryPartnerProfile {
    if (!input.companyName || input.companyName.trim().length < 2) {
      throw new Error("Le nom de la société de livraison est obligatoire.");
    }
    if (!input.legalRegistrationNumber) {
      throw new Error("Le numéro d'immatriculation légal ou SIRET est obligatoire.");
    }

    const id = `del_partner_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const partner: DeliveryPartnerProfile = {
      id,
      userId: input.userId,
      spaceId: input.spaceId,
      companyName: input.companyName.trim(),
      legalRegistrationNumber: input.legalRegistrationNumber.trim(),
      vatNumber: input.vatNumber?.trim(),
      contactEmail: input.contactEmail.toLowerCase().trim(),
      contactPhone: input.contactPhone.trim(),
      fleetSize: input.fleetSize ?? 1,
      coverageZones: input.coverageZones ?? ["national"],
      vehicleTypes: input.vehicleTypes ?? ["van"],
      status: "pending_verification",
      createdAt: now,
      updatedAt: now,
    };

    this.partners.set(id, partner);
    return partner;
  }

  getPartner(partnerId: string): DeliveryPartnerProfile | null {
    const p = this.partners.get(partnerId);
    return p ? { ...p } : null;
  }

  getPartnerByUserId(userId: string): DeliveryPartnerProfile | null {
    for (const p of this.partners.values()) {
      if (p.userId === userId) return { ...p };
    }
    return null;
  }

  listPartners(filter?: { status?: DeliveryPartnerStatus }): DeliveryPartnerProfile[] {
    const list = Array.from(this.partners.values());
    if (filter?.status) {
      return list.filter((p) => p.status === filter.status);
    }
    return list;
  }

  verifyPartner(
    partnerId: string,
    status: "verified" | "rejected" | "suspended",
    adminUserId: string,
    notes?: string
  ): DeliveryPartnerProfile {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      throw new Error("Société de livraison introuvable.");
    }

    partner.status = status;
    partner.verifiedBy = adminUserId;
    partner.verifiedAt = new Date().toISOString();
    partner.verificationNotes = notes;
    partner.updatedAt = new Date().toISOString();

    return { ...partner };
  }

  assignShipment(input: {
    orderId: string;
    sellerId: string;
    sellerSpaceId?: string;
    partnerId: string;
    recipientName: string;
    shippingAddress: string;
    shippingCity: string;
    notes?: string;
    trackingNumber?: string;
  }): ShipmentRecord {
    const partner = this.partners.get(input.partnerId);
    if (!partner) {
      throw new Error("Société de livraison introuvable.");
    }
    if (partner.status !== "verified") {
      throw new Error("Impossible d'assigner une livraison : le transporteur n'a pas encore été vérifié par un administrateur.");
    }

    const id = `ship_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const trackingNumber = input.trackingNumber || `TRK-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const shipment: ShipmentRecord = {
      id,
      orderId: input.orderId,
      sellerId: input.sellerId,
      sellerSpaceId: input.sellerSpaceId,
      partnerId: input.partnerId,
      trackingNumber,
      carrierName: partner.companyName,
      recipientName: input.recipientName,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      status: "assigned",
      statusHistory: [
        {
          status: "assigned",
          timestamp: now,
          comment: `Livraison assignée au transporteur ${partner.companyName}`,
        },
      ],
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.shipments.set(id, shipment);
    return shipment;
  }

  updateShipmentStatus(
    shipmentId: string,
    newStatus: ShipmentStatus,
    location?: string,
    comment?: string
  ): ShipmentRecord {
    const shipment = this.shipments.get(shipmentId);
    if (!shipment) {
      throw new Error("Expédition introuvable.");
    }

    const now = new Date().toISOString();
    shipment.status = newStatus;
    shipment.statusHistory.push({
      status: newStatus,
      timestamp: now,
      location,
      comment,
    });
    shipment.updatedAt = now;

    if (newStatus === "delivered") {
      shipment.deliveredAt = now;
    }

    return { ...shipment };
  }

  listShipments(filter?: {
    partnerId?: string;
    sellerId?: string;
    orderId?: string;
    status?: ShipmentStatus;
  }): ShipmentRecord[] {
    return Array.from(this.shipments.values()).filter((s) => {
      if (filter?.partnerId && s.partnerId !== filter.partnerId) return false;
      if (filter?.sellerId && s.sellerId !== filter.sellerId) return false;
      if (filter?.orderId && s.orderId !== filter.orderId) return false;
      if (filter?.status && s.status !== filter.status) return false;
      return true;
    });
  }
}

export const deliveryPartnerService = new DeliveryPartnerService();
