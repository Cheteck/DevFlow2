import * as crypto from 'node:crypto';
import type { Incident, Need, Donation, Resource, Hub, Mission, Distribution } from '../domain/models.js';
import {
  allocateStockSafely,
  assessNeedPriority,
  buildHxlRows,
  calculateCoveragePercent,
  IdempotencyRegistry,
  type HXLExportRow,
  type NeedAllocation,
  type NeedPriorityAssessment,
} from '../domain/solidarity-operational-rules.js';

export interface SolidarityRepositoryPort {
  saveIncident(incident: Incident): Promise<void>;
  getIncidents(): Promise<Incident[]>;
  saveNeed(need: Need): Promise<void>;
  getNeeds(): Promise<Need[]>;
  saveDonation(donation: Donation): Promise<void>;
  getDonations(): Promise<Donation[]>;
  saveResource(resource: Resource): Promise<void>;
  getResources(): Promise<Resource[]>;
  saveHub(hub: Hub): Promise<void>;
  getHubs(): Promise<Hub[]>;
  findDefaultHub(): Promise<Hub | null>;
  saveMission(mission: Mission): Promise<void>;
  getMissions(): Promise<Mission[]>;
  saveDistribution(distribution: Distribution): Promise<void>;
  getDistributions(): Promise<Distribution[]>;
  saveAllocation(allocation: NeedAllocation): Promise<void>;
  getAllocationByKey(idempotencyKey: string): Promise<NeedAllocation | null>;
}

const NEED_URGENCY_LEVEL: Record<Need['urgency'], number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
};

export interface ResourceMatchProposal {
  resourceId: string;
  hubId: string;
  allocatedQuantity: number;
  reason: string;
}

export class SolidarityService {
  private incidents = new Map<string, Incident>();
  private needs = new Map<string, Need>();
  private donations = new Map<string, Donation>();
  private resources = new Map<string, Resource>();
  private hubs = new Map<string, Hub>();
  private missions = new Map<string, Mission>();
  private distributions = new Map<string, Distribution>();
  private readonly idempotencyRegistry = new IdempotencyRegistry();

  constructor(private readonly repository?: SolidarityRepositoryPort) {}

  async createIncident(data: Omit<Incident, 'id' | 'status'>): Promise<Incident> {
    const incident: Incident = {
      ...data,
      id: `INC-${crypto.randomUUID()}`,
      status: 'ACTIVE'
    };
    this.incidents.set(incident.id, incident);
    if (this.repository) {
      await this.repository.saveIncident(incident);
    }
    return incident;
  }

  async declareNeed(data: Omit<Need, 'id' | 'quantitySatisfied' | 'status' | 'createdAt'>): Promise<Need> {
    const need: Need = {
      ...data,
      id: `NEED-${crypto.randomUUID()}`,
      quantitySatisfied: 0,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };
    this.needs.set(need.id, need);
    if (this.repository) {
      await this.repository.saveNeed(need);
    }
    return need;
  }

  async submitDonation(data: Omit<Donation, 'id' | 'verificationStatus' | 'createdAt'> & { hubId?: string }): Promise<Donation> {
    const donation: Donation = {
      ...data,
      id: `DON-${crypto.randomUUID()}`,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString()
    };
    this.donations.set(donation.id, donation);

    // Determine hubId: use provided, else find/create default
    let hubId = data.hubId;
    if (!hubId && this.repository) {
      const defaultHub = await this.repository.findDefaultHub();
      if (defaultHub) {
        hubId = defaultHub.id;
      } else {
        // Create a default hub as fallback
        const fallbackHub: Hub = {
          id: `HUB-${crypto.randomUUID()}`,
          spaceId: 'DEFAULT-SPACE',
          name: 'Default Hub',
          type: 'WAREHOUSE',
          capacityM3: 1000,
          trustLevel: 'UNVERIFIED',
          geoZone: 'DEFAULT'
        };
        hubId = fallbackHub.id;
        this.hubs.set(fallbackHub.id, fallbackHub);
        await this.repository.saveHub(fallbackHub);
      }
    }
    if (!hubId) {
      hubId = 'HUB-DEFAULT';
    }

    // Auto-create Resource
    const resource: Resource = {
      id: `RES-${crypto.randomUUID()}`,
      donationId: donation.id,
      ownerId: donation.donorId,
      type: donation.itemType,
      totalQuantity: donation.quantity,
      availableQuantity: donation.quantity,
      hubId,
      status: 'AVAILABLE'
    };
    this.resources.set(resource.id, resource);

    if (this.repository) {
      await this.repository.saveDonation(donation);
      await this.repository.saveResource(resource);
    }

    return donation;
  }

  async registerHub(data: Omit<Hub, 'id'>): Promise<Hub> {
    const hub: Hub = {
      ...data,
      id: `HUB-${crypto.randomUUID()}`
    };
    this.hubs.set(hub.id, hub);
    if (this.repository) {
      await this.repository.saveHub(hub);
    }
    return hub;
  }

  async assignMission(data: Omit<Mission, 'id' | 'status'>): Promise<Mission> {
    const mission: Mission = {
      ...data,
      id: `MIS-${crypto.randomUUID()}`,
      status: 'IN_TRANSIT'
    };
    this.missions.set(mission.id, mission);
    if (this.repository) {
      await this.repository.saveMission(mission);
    }
    return mission;
  }

  async confirmDistribution(data: Omit<Distribution, 'id' | 'timestamp'>): Promise<Distribution> {
    const distribution: Distribution = {
      ...data,
      id: `DIST-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString()
    };
    this.distributions.set(distribution.id, distribution);
    if (this.repository) {
      await this.repository.saveDistribution(distribution);
    }
    return distribution;
  }

  /**
   * Explainable prioritisation for a need (§2.2). Proposes, never decides.
   */
  assessNeed(needId: string): NeedPriorityAssessment | undefined {
    const need = this.needs.get(needId);
    if (!need) return undefined;
    return assessNeedPriority({
      category: need.type,
      requested: need.quantityRequired,
      distributed: need.quantitySatisfied,
      urgency: NEED_URGENCY_LEVEL[need.urgency],
    });
  }

  /**
   * Displayed coverage (§2.2): distributed / requested only.
   */
  getNeedCoverage(needId: string): { requested: number; distributed: number; percent: number } | undefined {
    const need = this.needs.get(needId);
    if (!need) return undefined;
    return {
      requested: need.quantityRequired,
      distributed: need.quantitySatisfied,
      percent: calculateCoveragePercent(need.quantityRequired, need.quantitySatisfied),
    };
  }

  /**
   * Confirms a resource allocation with over-allocation guard and
   * idempotent replay (§2.3, §2.4, §8). Reserves source stock on success.
   */
  async allocateResource(
    resourceId: string,
    needId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<{ success: boolean; allocation?: NeedAllocation; error?: string; alreadyProcessed?: boolean }> {
    // Durable idempotence first: a replay after restart resolves from the ledger.
    if (this.repository) {
      const stored = await this.repository.getAllocationByKey(idempotencyKey);
      if (stored) {
        return { success: true, allocation: stored, alreadyProcessed: true };
      }
    }
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return { success: false, error: `Unknown resource '${resourceId}'.` };
    }
    const result = allocateStockSafely(
      {
        id: resource.id,
        hubId: resource.hubId,
        category: resource.type,
        itemName: resource.type,
        unit: "unit",
        physical: resource.totalQuantity,
        reserved: resource.totalQuantity - resource.availableQuantity,
        available: resource.availableQuantity,
        unusable: 0,
        lastMovedAt: new Date().toISOString(),
      },
      quantity,
      "unit",
      needId,
      idempotencyKey,
      this.idempotencyRegistry,
    );
    if (!result.success || !result.updatedStock) {
      return { success: result.success, error: result.error, alreadyProcessed: result.alreadyProcessed };
    }
    if (!result.alreadyProcessed) {
      resource.availableQuantity = result.updatedStock.available;
      resource.status = resource.availableQuantity <= 0 ? "ALLOCATED" : "AVAILABLE";
      this.resources.set(resource.id, resource);
      if (this.repository) {
        await this.repository.saveResource(resource);
        if (result.allocation) {
          await this.repository.saveAllocation(result.allocation);
        }
      }
    }
    return { success: true, allocation: result.allocation, alreadyProcessed: result.alreadyProcessed };
  }

  /**
   * Proposes compatible resources for a need, ranked by availability
   * (§2.8: suggestion only — confirmation stays a separate step).
   */
  proposeMatchesForNeed(needId: string): ResourceMatchProposal[] {
    const need = this.needs.get(needId);
    if (!need) return [];
    const remaining = need.quantityRequired - need.quantitySatisfied;
    if (remaining <= 0) return [];
    return Array.from(this.resources.values())
      .filter((r) => r.type.toUpperCase() === need.type.toUpperCase() && r.availableQuantity > 0)
      .sort((a, b) => b.availableQuantity - a.availableQuantity)
      .slice(0, 5)
      .map((r) => ({
        resourceId: r.id,
        hubId: r.hubId,
        allocatedQuantity: Math.min(remaining, r.availableQuantity),
        reason: `${r.availableQuantity} available at hub ${r.hubId} for ${remaining} remaining`,
      }));
  }

  /**
   * HXL aggregate rows for needs (§2.11 — aggregates only, no PII).
   */
  buildHxlReport(crisisName: string): HXLExportRow[] {
    return buildHxlRows(
      crisisName,
      Array.from(this.needs.values()).map((n) => ({
        wilayaCode: n.geoZone,
        commune: n.geoZone,
        type: n.type,
        title: n.type,
        unit: "unit",
        requested: n.quantityRequired,
        distributed: n.quantitySatisfied,
        status: n.status,
        reportedAt: n.createdAt,
      })),
    );
  }

  getIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  async getIncidentsAsync(): Promise<Incident[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getIncidents();
        if (fromDb.length > 0) {
          for (const inc of fromDb) {
            this.incidents.set(inc.id, inc);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch incidents:", err);
      }
    }
    return this.getIncidents();
  }

  getNeeds(): Need[] {
    return Array.from(this.needs.values());
  }

  async getNeedsAsync(): Promise<Need[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getNeeds();
        if (fromDb.length > 0) {
          for (const n of fromDb) {
            this.needs.set(n.id, n);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch needs:", err);
      }
    }
    return this.getNeeds();
  }

  getDonations(): Donation[] {
    return Array.from(this.donations.values());
  }

  async getDonationsAsync(): Promise<Donation[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getDonations();
        if (fromDb.length > 0) {
          for (const d of fromDb) {
            this.donations.set(d.id, d);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch donations:", err);
      }
    }
    return this.getDonations();
  }

  getHubs(): Hub[] {
    return Array.from(this.hubs.values());
  }

  async getHubsAsync(): Promise<Hub[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getHubs();
        if (fromDb.length > 0) {
          for (const h of fromDb) {
            this.hubs.set(h.id, h);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch hubs:", err);
      }
    }
    return this.getHubs();
  }

  getMissions(): Mission[] {
    return Array.from(this.missions.values());
  }

  async getMissionsAsync(): Promise<Mission[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getMissions();
        if (fromDb.length > 0) {
          for (const m of fromDb) {
            this.missions.set(m.id, m);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch missions:", err);
      }
    }
    return this.getMissions();
  }

  getResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  async getResourcesAsync(): Promise<Resource[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getResources();
        if (fromDb.length > 0) {
          for (const r of fromDb) {
            this.resources.set(r.id, r);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch resources:", err);
      }
    }
    return this.getResources();
  }

  getDistributions(): Distribution[] {
    return Array.from(this.distributions.values());
  }

  async getDistributionsAsync(): Promise<Distribution[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getDistributions();
        if (fromDb.length > 0) {
          for (const d of fromDb) {
            this.distributions.set(d.id, d);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solidarity] Failed to fetch distributions:", err);
      }
    }
    return this.getDistributions();
  }
}
