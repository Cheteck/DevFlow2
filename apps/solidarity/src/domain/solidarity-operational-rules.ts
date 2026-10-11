/**
 * @apps/solidarity — Operational rules ported from the Solidarity maquette.
 * Framework-free domain logic (responsibilities.md §2, §7, §8) :
 * explainable need prioritisation, strict counters, unit homogeneity,
 * non-destructive reports, safe stock allocation, proportionate proofs,
 * two-stage volunteer matching, HXL rows, idempotency, HMAC pseudonymisation.
 */

import * as crypto from "node:crypto";
import {
  calculateHaversineDistanceKm,
  type GeoCoordinates,
} from "./solidarity-geospatial-matching.js";

// ---------------------------------------------------------------------------
// 1. Explainable need prioritisation (§2.2 — no opaque score)
// ---------------------------------------------------------------------------

export interface NeedPriorityAssessment {
  gravity: 1 | 2 | 3 | 4 | 5;
  deficit: 1 | 2 | 3 | 4 | 5;
  confidence: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
  verifyUrgently: boolean;
}

export interface NeedPriorityInput {
  category: string;
  requested: number;
  distributed: number;
  urgency?: number;
  isEnclaved?: boolean;
  verifiedAt?: string;
  trustScore?: number;
}

const VITAL_CATEGORIES = ["MEDICAL", "WATER", "SEARCH_AND_RESCUE", "SHELTER"];

export function assessNeedPriority(input: NeedPriorityInput): NeedPriorityAssessment {
  const {
    category,
    requested,
    distributed,
    urgency = 3,
    isEnclaved = false,
    verifiedAt,
    trustScore,
  } = input;
  const reasons: string[] = [];
  const cat = category.toUpperCase();
  const isVital = VITAL_CATEGORIES.includes(cat) || urgency >= 4;

  let gravity: 1 | 2 | 3 | 4 | 5 = 2;
  if (cat === "SEARCH_AND_RESCUE") {
    gravity = 5;
    reasons.push("Search and rescue: immediate lethal danger (gravity 5/5)");
  } else if (cat === "MEDICAL" || cat === "WATER") {
    gravity = urgency >= 4 ? 5 : 4;
    reasons.push(`Life-critical supply (gravity ${gravity}/5)`);
  } else if (urgency >= 4) {
    gravity = 4;
    reasons.push(`Declared operational urgency level ${urgency}/5`);
  } else {
    reasons.push("Support logistics need (gravity 2/5)");
  }
  if (isEnclaved) {
    reasons.push("Enclaved zone / degraded access: isolation over-risk");
  }

  const remaining = Math.max(0, requested - distributed);
  const uncoveredRatio = requested > 0 ? remaining / requested : 0;
  let deficit: 1 | 2 | 3 | 4 | 5 = 1;
  if (uncoveredRatio >= 0.99) {
    deficit = 5;
    reasons.push(`Total deficit: 0% distributed of ${requested} requested (deficit 5/5)`);
  } else if (uncoveredRatio >= 0.7) {
    deficit = 4;
    reasons.push(`Severe deficit: ${Math.round(uncoveredRatio * 100)}% remaining (deficit 4/5)`);
  } else if (uncoveredRatio >= 0.4) {
    deficit = 3;
    reasons.push(`Medium deficit: ${Math.round(uncoveredRatio * 100)}% remaining (deficit 3/5)`);
  } else if (uncoveredRatio > 0.05) {
    deficit = 2;
    reasons.push(`Residual deficit: ${Math.round(uncoveredRatio * 100)}% remaining (deficit 2/5)`);
  } else {
    reasons.push("Need almost covered or satisfied (deficit 1/5)");
  }

  const isVerified = Boolean(verifiedAt);
  let confidence: 1 | 2 | 3 | 4 | 5 = 2;
  if (isVerified && (trustScore ?? 4) >= 4) {
    confidence = 5;
    reasons.push("Certified source verified on site (confidence 5/5)");
  } else if (isVerified) {
    confidence = 4;
    reasons.push("Report verified by a coordination agent (confidence 4/5)");
  } else if (trustScore !== undefined && trustScore >= 3) {
    confidence = 3;
    reasons.push("Report from a known local relay, formal verification pending (confidence 3/5)");
  } else {
    reasons.push("Report not yet verified on site (confidence 2/5)");
  }

  const verifyUrgently = isVital && !isVerified;
  if (verifyUrgently) {
    reasons.push("UNVERIFIED VITAL ALERT: urgent field verification required, never silently deprioritised");
  }

  return { gravity, deficit, confidence, reasons, verifyUrgently };
}

/** Transparent 0..100 ordering score derived from the assessment above. */
export function computeNeedPriorityScore(input: NeedPriorityInput): number {
  const assessment = assessNeedPriority(input);
  let score = assessment.gravity * 12 + assessment.deficit * 6;
  if (input.isEnclaved) score += 10;
  if (assessment.verifyUrgently) score += 10;
  return Math.min(100, Math.max(10, Math.round(score)));
}

/**
 * Displayed coverage (§2.2): distributed / requested only.
 * Promises and in-transit stock never count.
 */
export function calculateCoveragePercent(requested: number, distributed: number): number {
  if (requested <= 0) return 100;
  return Math.min(100, Math.round((distributed / requested) * 100));
}

// ---------------------------------------------------------------------------
// 2. Unit homogeneity (§2.2 — never add incompatible units)
// ---------------------------------------------------------------------------

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

const VOLUME_UNITS = ["l", "litre", "litres", "liter", "liters", "m3"];
const MASS_UNITS = ["kg", "kilo", "kilos", "kilogramme", "kilogrammes", "tonne", "tonnes"];
const COUNT_UNITS = ["unit", "units", "unite", "unites", "kit", "kits", "lot", "lots", "tent", "tents", "box", "boxes", "pack", "packs"];

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const a = normalizeUnit(unitA);
  const b = normalizeUnit(unitB);
  if (a === b) return true;
  if (VOLUME_UNITS.includes(a) && VOLUME_UNITS.includes(b)) return true;
  if (MASS_UNITS.includes(a) && MASS_UNITS.includes(b)) return true;
  if (COUNT_UNITS.includes(a) && COUNT_UNITS.includes(b)) return true;
  return false;
}

export function assertUnitsCompatible(unitA: string, unitB: string, context = "operation"): void {
  if (!areUnitsCompatible(unitA, unitB)) {
    throw new Error(
      `Unit mismatch [${context}]: cannot add or transfer '${unitA}' with '${unitB}'.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Non-destructive reports (§2.1)
// ---------------------------------------------------------------------------

export interface NeedReport {
  id: string;
  source: string;
  trust: number;
  observedAt: string;
  location: string;
  category: string;
  quantity: number;
  unit: string;
  details?: string;
  contradictionFlag?: boolean;
}

export interface DuplicateCandidate {
  needIdA: string;
  needIdB: string;
  distanceKm: number;
  contradiction: boolean;
}

/** Proposes groupings, never deletes source reports. Quantity gaps flag verification. */
export function detectDuplicateNeeds(
  needs: Array<{ id: string; type: string; requested: number; unit: string; location: GeoCoordinates }>,
  maxDistanceKm = 3.5,
): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < needs.length; i++) {
    for (let j = i + 1; j < needs.length; j++) {
      const a = needs[i];
      const b = needs[j];
      if (a.type.toUpperCase() !== b.type.toUpperCase()) continue;
      const key = [a.id, b.id].sort().join("--");
      if (seen.has(key)) continue;
      const distanceKm = calculateHaversineDistanceKm(a.location, b.location);
      if (distanceKm > maxDistanceKm) continue;
      seen.add(key);
      const ratio = Math.max(a.requested, b.requested) / Math.max(1, Math.min(a.requested, b.requested));
      out.push({ needIdA: a.id, needIdB: b.id, distanceKm: Math.round(distanceKm * 10) / 10, contradiction: ratio > 2.5 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Safe resources and stocks (§2.3, §2.4, §8)
// ---------------------------------------------------------------------------

export interface ResourceOffer {
  id: string;
  source: string;
  contactHash: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  status: "OFFERED" | "VALIDATED" | "REJECTED";
  createdAt: string;
}

export interface ResourceStock {
  id: string;
  hubId: string;
  category: string;
  itemName: string;
  unit: string;
  physical: number;
  reserved: number;
  available: number;
  unusable: number;
  lastMovedAt: string;
}

export interface NeedAllocation {
  id: string;
  needId: string;
  stockId: string;
  hubId: string;
  quantity: number;
  unit: string;
  status: "PROPOSED" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  idempotencyKey: string;
}

export interface Shipment {
  id: string;
  code: string;
  departureHubId: string;
  destinationNeedId: string;
  allocationIds: string[];
  vehicleType: string;
  status: "PREPARING" | "IN_TRANSIT" | "ARRIVED";
  dispatchedAt: string;
}

export type ProofLevel = "MINIMAL_ATTESTATION" | "SIGNATURE" | "PHOTO_GEO";

export interface DistributionRecord {
  id: string;
  needId: string;
  shipmentId?: string;
  allocationId?: string;
  quantity: number;
  unit: string;
  distributedAt: string;
  actor: string;
  proofType: ProofLevel;
  proofJustification?: string;
  beneficiaryAcknowledgment: string;
  idempotencyKey: string;
  isCorrection?: boolean;
  correctedRecordId?: string;
  correctionReason?: string;
}

/** In-memory idempotency registry: same key replays without re-mutating. */
export class IdempotencyRegistry {
  private executedKeys = new Map<string, { timestamp: string; result: unknown }>();

  has(key: string): boolean {
    return this.executedKeys.has(key);
  }

  record(key: string, result: unknown): void {
    this.executedKeys.set(key, { timestamp: new Date().toISOString(), result });
  }

  get<T>(key: string): T | undefined {
    return this.executedKeys.get(key)?.result as T | undefined;
  }

  clear(): void {
    this.executedKeys.clear();
  }
}

export interface SafeAllocationResult {
  success: boolean;
  allocation?: NeedAllocation;
  updatedStock?: ResourceStock;
  error?: string;
  alreadyProcessed?: boolean;
}

export function allocateStockSafely(
  stock: ResourceStock,
  requestedQuantity: number,
  requestedUnit: string,
  needId: string,
  idempotencyKey: string,
  registry: IdempotencyRegistry,
): SafeAllocationResult {
  const replayed = registry.get<{ allocation: NeedAllocation; updatedStock: ResourceStock }>(idempotencyKey);
  if (replayed) {
    return { success: true, allocation: replayed.allocation, updatedStock: stock, alreadyProcessed: true };
  }
  try {
    assertUnitsCompatible(stock.unit, requestedUnit, "stock allocation");
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
  if (requestedQuantity <= 0) {
    return { success: false, error: "Allocation quantity must be greater than 0." };
  }
  const currentAvailable = stock.physical - stock.reserved;
  if (requestedQuantity > currentAvailable) {
    return {
      success: false,
      error: `Over-allocation refused: ${currentAvailable} ${stock.unit} available, ${requestedQuantity} ${stock.unit} requested.`,
    };
  }
  const newReserved = stock.reserved + requestedQuantity;
  const updatedStock: ResourceStock = {
    ...stock,
    reserved: newReserved,
    available: stock.physical - newReserved,
    lastMovedAt: new Date().toISOString(),
  };
  const allocation: NeedAllocation = {
    id: `alloc-${crypto.randomUUID()}`,
    needId,
    stockId: stock.id,
    hubId: stock.hubId,
    quantity: requestedQuantity,
    unit: stock.unit,
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };
  registry.record(idempotencyKey, { allocation, updatedStock });
  return { success: true, allocation, updatedStock };
}

export interface SafeDistributionResult {
  success: boolean;
  distributionRecord?: DistributionRecord;
  updatedStock?: ResourceStock;
  error?: string;
  alreadyProcessed?: boolean;
}

export function confirmDistributionSafely(
  params: {
    stock?: ResourceStock;
    needId: string;
    quantity: number;
    unit: string;
    proofType: ProofLevel;
    proofJustification?: string;
    beneficiaryAcknowledgment: string;
    actor: string;
    idempotencyKey: string;
    isCorrection?: boolean;
    correctedRecordId?: string;
    correctionReason?: string;
  },
  registry: IdempotencyRegistry,
): SafeDistributionResult {
  const {
    stock,
    needId,
    quantity,
    unit,
    proofType,
    proofJustification,
    beneficiaryAcknowledgment,
    actor,
    idempotencyKey,
    isCorrection,
    correctedRecordId,
    correctionReason,
  } = params;

  const replayed = registry.get<{ distributionRecord: DistributionRecord; updatedStock?: ResourceStock }>(idempotencyKey);
  if (replayed) {
    return {
      success: true,
      distributionRecord: replayed.distributionRecord,
      updatedStock: stock,
      alreadyProcessed: true,
    };
  }
  if (proofType !== "MINIMAL_ATTESTATION" && (!proofJustification || proofJustification.trim().length < 5)) {
    return {
      success: false,
      error: `Proportionate proof: ${proofType} requires a written justification for collecting sensitive data.`,
    };
  }
  let updatedStock = stock;
  if (stock) {
    try {
      assertUnitsCompatible(stock.unit, unit, "distribution confirmation");
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
    if (quantity > stock.physical) {
      return {
        success: false,
        error: `Distribution impossible: insufficient physical stock (${stock.physical} ${stock.unit} < ${quantity} ${unit}).`,
      };
    }
    const newPhysical = Math.max(0, stock.physical - quantity);
    const newReserved = Math.max(0, stock.reserved - quantity);
    updatedStock = {
      ...stock,
      physical: newPhysical,
      reserved: newReserved,
      available: newPhysical - newReserved,
      lastMovedAt: new Date().toISOString(),
    };
  }
  const record: DistributionRecord = {
    id: `dist-${crypto.randomUUID()}`,
    needId,
    quantity,
    unit,
    distributedAt: new Date().toISOString(),
    actor,
    proofType,
    proofJustification,
    beneficiaryAcknowledgment,
    idempotencyKey,
    isCorrection,
    correctedRecordId,
    correctionReason,
  };
  registry.record(idempotencyKey, { distributionRecord: record, updatedStock });
  return { success: true, distributionRecord: record, updatedStock };
}

// ---------------------------------------------------------------------------
// 5. Volunteer operational capacity (§2.6, §7.4 — no continuous GPS)
// ---------------------------------------------------------------------------

export type VolunteerAvailabilityStatus = "AVAILABLE" | "RESTING" | "DEPLOYED" | "UNAVAILABLE";
export type VolunteerMobility = "ON_FOOT" | "LIGHT_VEHICLE" | "OFFROAD_4X4" | "HEAVY_TRUCK";

export interface VolunteerCapacity {
  id: string;
  refOpaque: string;
  skillsDeclared: string[];
  skillsVerified: string[];
  availability: VolunteerAvailabilityStatus;
  mobility: VolunteerMobility;
  operationalRestrictions: string[];
  currentActiveMissionsCount: number;
  maxMissionsPerWeek: number;
  briefedCrisisTypes: string[];
}

export interface VolunteerMatchEvaluation {
  volunteer: VolunteerCapacity;
  eligible: boolean;
  eliminationReasons: string[];
  optimizationScore: number;
  scoreDetails: { skillMatchScore: number; fatigueWorkloadScore: number; mobilityFitScore: number };
  explanation: string;
}

export function matchVolunteerForMission(
  volunteer: VolunteerCapacity,
  mission: { crisisType: string; difficulty: string; requiredSkill?: string },
): VolunteerMatchEvaluation {
  const eliminationReasons: string[] = [];
  if (volunteer.availability === "UNAVAILABLE") {
    eliminationReasons.push("Volunteer currently unavailable");
  } else if (volunteer.availability === "RESTING") {
    eliminationReasons.push("Mandatory physiological rest period active");
  } else if (volunteer.availability === "DEPLOYED") {
    eliminationReasons.push("Already engaged on an active mission");
  }
  if (volunteer.currentActiveMissionsCount >= volunteer.maxMissionsPerWeek) {
    eliminationReasons.push(
      `Weekly load cap reached (${volunteer.currentActiveMissionsCount}/${volunteer.maxMissionsPerWeek} missions)`,
    );
  }
  if (!volunteer.briefedCrisisTypes.includes(mission.crisisType)) {
    eliminationReasons.push(`Missing mandatory briefing for hazard "${mission.crisisType}"`);
  }
  if (
    mission.crisisType === "wildfire" &&
    volunteer.operationalRestrictions.some((r) => r.includes("SMOKE") || r.includes("ASTHMA"))
  ) {
    eliminationReasons.push("Formal restriction: smoke exposure prohibited");
  }
  if (mission.difficulty === "offroad_4x4" && volunteer.mobility === "ON_FOOT") {
    eliminationReasons.push("Mobility mismatch: isolated 4x4 track with pedestrian-only profile");
  }
  if (eliminationReasons.length > 0) {
    return {
      volunteer,
      eligible: false,
      eliminationReasons,
      optimizationScore: 0,
      scoreDetails: { skillMatchScore: 0, fatigueWorkloadScore: 0, mobilityFitScore: 0 },
      explanation: `Eliminated at stage 1: ${eliminationReasons.join(" · ")}`,
    };
  }
  let skillMatchScore = 60;
  if (mission.requiredSkill) {
    if (volunteer.skillsVerified.includes(mission.requiredSkill)) skillMatchScore = 100;
    else if (volunteer.skillsDeclared.includes(mission.requiredSkill)) skillMatchScore = 80;
    else skillMatchScore = 30;
  }
  const loadRatio = volunteer.currentActiveMissionsCount / Math.max(1, volunteer.maxMissionsPerWeek);
  const fatigueWorkloadScore = Math.round((1 - loadRatio) * 100);
  let mobilityFitScore = 70;
  if (mission.difficulty === "offroad_4x4" && volunteer.mobility === "OFFROAD_4X4") mobilityFitScore = 100;
  else if (volunteer.mobility === "LIGHT_VEHICLE") mobilityFitScore = 80;
  const totalScore = Math.round(skillMatchScore * 0.45 + fatigueWorkloadScore * 0.35 + mobilityFitScore * 0.2);
  return {
    volunteer,
    eligible: true,
    eliminationReasons: [],
    optimizationScore: totalScore,
    scoreDetails: { skillMatchScore, fatigueWorkloadScore, mobilityFitScore },
    explanation: `Eligible (stage 1 passed). Fit score ${totalScore}/100. Distance never dominant.`,
  };
}

// ---------------------------------------------------------------------------
// 6. Hub saturation and convoy suggestions (proposals stay application-level)
// ---------------------------------------------------------------------------

export interface HubRerouteSuggestion {
  saturatedHubId: string;
  rerouteHubId: string;
  distanceKm: number;
  reason: string;
}

export function detectHubSaturation(
  hubs: Array<{ id: string; name: string; capacityPercent: number; location: GeoCoordinates }>,
  saturatedAbove = 85,
  reliefBelow = 70,
): HubRerouteSuggestion[] {
  const out: HubRerouteSuggestion[] = [];
  for (const saturated of hubs.filter((h) => h.capacityPercent > saturatedAbove)) {
    const relief = hubs
      .filter((h) => h.id !== saturated.id && h.capacityPercent < reliefBelow)
      .map((h) => ({ hub: h, distance: calculateHaversineDistanceKm(saturated.location, h.location) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (relief) {
      out.push({
        saturatedHubId: saturated.id,
        rerouteHubId: relief.hub.id,
        distanceKm: Math.round(relief.distance * 10) / 10,
        reason: `${saturated.name} above critical threshold (${saturated.capacityPercent}%). Redirect to ${relief.hub.name}.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. HXL interoperability (§2.11 — aggregates only, no PII)
// ---------------------------------------------------------------------------

export interface HXLExportRow {
  crisisName: string;
  wilayaCode: string;
  communeName: string;
  sectorCluster: string;
  needItem: string;
  unit: string;
  quantityNeeded: number;
  quantityDistributed: number;
  coveragePct: number;
  statusCode: string;
  dateReported: string;
  coordinatingOrg: string;
}

export const HXL_HEADER =
  "#crisis+name,#adm1+code,#adm2+name,#sector+cluster,#item+name,#unit,#indicator+num+needed,#indicator+num+distributed,#indicator+pct+coverage,#status+code,#date+reported,#org+coordination";

export function buildHxlRows(
  crisisName: string,
  needs: Array<{
    wilayaCode: string;
    commune: string;
    type: string;
    title: string;
    unit: string;
    requested: number;
    distributed: number;
    status: string;
    reportedAt: string;
  }>,
  coordinatingOrg = "Solidarity MosaiX BAC",
): HXLExportRow[] {
  return needs.map((n) => ({
    crisisName,
    wilayaCode: n.wilayaCode,
    communeName: n.commune,
    sectorCluster: n.type,
    needItem: n.title,
    unit: n.unit,
    quantityNeeded: n.requested,
    quantityDistributed: n.distributed,
    coveragePct: calculateCoveragePercent(n.requested, n.distributed),
    statusCode: n.status,
    dateReported: n.reportedAt,
    coordinatingOrg,
  }));
}

// ---------------------------------------------------------------------------
// 8. Canonicalisation and HMAC pseudonymisation (§2.10, §7.3)
// ---------------------------------------------------------------------------

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function sha256Hex(message: string): string {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

/**
 * Irreversible beneficiary surrogate: HMAC-SHA256(serverPepper, incident|commune|household|hazard).
 * Never feed names, phones or exact addresses.
 */
export function computeBeneficiaryHmac(
  incidentId: string,
  commune: string,
  householdSize: number,
  hazard: string,
  serverPepper = "SOLIDARITY_DZ_NATIONAL_PEPPER_2026",
): string {
  const message = `${incidentId}|${commune.trim().toLowerCase()}|${householdSize}|${hazard}`;
  const hmac = crypto.createHmac("sha256", serverPepper).update(message, "utf8").digest("hex");
  return `BENEF-${hmac.slice(0, 12).toUpperCase()}`;
}
