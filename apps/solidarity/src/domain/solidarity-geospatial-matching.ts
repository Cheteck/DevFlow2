import * as crypto from "node:crypto";
import type { Need, Resource, Hub } from "./models.js";


export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoZoneDetails {
  code: string;
  name: string;
  centroid: GeoCoordinates;
  radiusKm?: number;
}

/**
 * Haversine formula for spherical distance calculation (in kilometers)
 */
export function calculateHaversineDistanceKm(coord1: GeoCoordinates, coord2: GeoCoordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) * (Math.PI / 180)) *
      Math.cos((coord2.latitude * Math.PI) * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface MatchScore {
  needId: string;
  donationId?: string;
  resourceId?: string;
  hubId?: string;
  score: number; // 0 to 100
  distanceKm: number;
  allocatedQuantity: number;
}

/**
 * Humanitarian Automated Matching Engine
 */
export class SolidarityMatchingEngine {
  private static readonly URGENCY_MULTIPLIER: Record<string, number> = {
    CRITICAL: 1.5,
    HIGH: 1.25,
    MEDIUM: 1.0,
    LOW: 0.8,
  };

  static matchNeedWithResources(
    need: Need,
    needLocation: GeoCoordinates,
    availableResources: Array<{ resource: Resource; hub: Hub; hubLocation: GeoCoordinates }>,
  ): MatchScore[] {
    const remainingNeed = need.quantityRequired - need.quantitySatisfied;
    if (remainingNeed <= 0) return [];

    const matches: MatchScore[] = [];

    for (const { resource, hub, hubLocation } of availableResources) {
      if (resource.type.toUpperCase() !== need.type.toUpperCase()) continue;
      if (resource.availableQuantity <= 0) continue;

      const distance = calculateHaversineDistanceKm(needLocation, hubLocation);
      const urgencyFactor = this.URGENCY_MULTIPLIER[need.urgency] ?? 1.0;

      // Distance score: closer is better (e.g. 100 max within 5km, decaying beyond)
      const distanceScore = Math.max(0, 100 - distance * 2);
      const totalScore = Math.min(100, distanceScore * urgencyFactor);

      const allocatedQuantity = Math.min(remainingNeed, resource.availableQuantity);

      matches.push({
        needId: need.id,
        resourceId: resource.id,
        hubId: hub.id,
        score: Math.round(totalScore),
        distanceKm: Math.round(distance * 10) / 10,
        allocatedQuantity,
      });
    }

    // Sort by descending score
    return matches.sort((a, b) => b.score - a.score);
  }
}

/**
 * Merkle Tree / Cryptographic Audit Trail for Humanitarian Distributions
 */
export interface MerkleAuditBlock {
  index: number;
  distributionId: string;
  recipientId: string;
  quantity: number;
  proofKey: string;
  previousHash: string;
  timestamp: string;
  hash: string;
}

export class MerkleAuditTrail {
  private chain: MerkleAuditBlock[] = [];

  constructor() {
    // Genesis block
    const genesisHash = crypto.createHash("sha256").update("MOSAIX_SOLIDARITY_GENESIS_ROOT").digest("hex");
    this.chain.push({
      index: 0,
      distributionId: "genesis",
      recipientId: "system",
      quantity: 0,
      proofKey: "root",
      previousHash: "0",
      timestamp: new Date().toISOString(),
      hash: genesisHash,
    });
  }

  recordDistribution(distributionId: string, recipientId: string, quantity: number, proofKey: string): MerkleAuditBlock {
    const previous = this.chain[this.chain.length - 1];
    const index = previous.index + 1;
    const timestamp = new Date().toISOString();

    const dataString = `${index}|${distributionId}|${recipientId}|${quantity}|${proofKey}|${previous.hash}|${timestamp}`;
    const hash = crypto.createHash("sha256").update(dataString).digest("hex");

    const block: MerkleAuditBlock = {
      index,
      distributionId,
      recipientId,
      quantity,
      proofKey,
      previousHash: previous.hash,
      timestamp,
      hash,
    };

    this.chain.push(block);
    return block;
  }

  verifyChain(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.previousHash !== previous.hash) {
        return false;
      }

      const dataString = `${current.index}|${current.distributionId}|${current.recipientId}|${current.quantity}|${current.proofKey}|${current.previousHash}|${current.timestamp}`;
      const computed = crypto.createHash("sha256").update(dataString).digest("hex");

      if (computed !== current.hash) {
        return false;
      }
    }
    return true;
  }

  getProofForDistribution(distributionId: string): MerkleAuditBlock | undefined {
    return this.chain.find((b) => b.distributionId === distributionId);
  }
}
