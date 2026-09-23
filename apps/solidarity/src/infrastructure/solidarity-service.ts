import type { Incident, Need, Donation, Resource, Hub, Mission, Distribution } from '../domain/models.js';

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
  saveMission(mission: Mission): Promise<void>;
  getMissions(): Promise<Mission[]>;
  saveDistribution(distribution: Distribution): Promise<void>;
  getDistributions(): Promise<Distribution[]>;
}

export class SolidarityService {
  private incidents = new Map<string, Incident>();
  private needs = new Map<string, Need>();
  private donations = new Map<string, Donation>();
  private resources = new Map<string, Resource>();
  private hubs = new Map<string, Hub>();
  private missions = new Map<string, Mission>();
  private distributions = new Map<string, Distribution>();

  constructor(private readonly repository?: SolidarityRepositoryPort) {}

  createIncident(data: Omit<Incident, 'id' | 'status'>): Incident {
    const incident: Incident = {
      ...data,
      id: `INC-${Date.now()}`,
      status: 'ACTIVE'
    };
    this.incidents.set(incident.id, incident);
    if (this.repository) {
      void this.repository.saveIncident(incident).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist incident:", err);
      });
    }
    return incident;
  }

  declareNeed(data: Omit<Need, 'id' | 'quantitySatisfied' | 'status' | 'createdAt'>): Need {
    const need: Need = {
      ...data,
      id: `NEED-${Date.now()}`,
      quantitySatisfied: 0,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };
    this.needs.set(need.id, need);
    if (this.repository) {
      void this.repository.saveNeed(need).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist need:", err);
      });
    }
    return need;
  }

  submitDonation(data: Omit<Donation, 'id' | 'verificationStatus' | 'createdAt'>): Donation {
    const donation: Donation = {
      ...data,
      id: `DON-${Date.now()}`,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString()
    };
    this.donations.set(donation.id, donation);

    // Auto-create Resource
    const resource: Resource = {
      id: `RES-${Date.now()}`,
      donationId: donation.id,
      ownerId: donation.donorId,
      type: donation.itemType,
      totalQuantity: donation.quantity,
      availableQuantity: donation.quantity,
      hubId: 'HUB-DEFAULT',
      status: 'AVAILABLE'
    };
    this.resources.set(resource.id, resource);

    if (this.repository) {
      void this.repository.saveDonation(donation).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist donation:", err);
      });
      void this.repository.saveResource(resource).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist resource:", err);
      });
    }

    return donation;
  }

  registerHub(data: Omit<Hub, 'id'>): Hub {
    const hub: Hub = {
      ...data,
      id: `HUB-${Date.now()}`
    };
    this.hubs.set(hub.id, hub);
    if (this.repository) {
      void this.repository.saveHub(hub).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist hub:", err);
      });
    }
    return hub;
  }

  assignMission(data: Omit<Mission, 'id' | 'status'>): Mission {
    const mission: Mission = {
      ...data,
      id: `MIS-${Date.now()}`,
      status: 'IN_TRANSIT'
    };
    this.missions.set(mission.id, mission);
    if (this.repository) {
      void this.repository.saveMission(mission).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist mission:", err);
      });
    }
    return mission;
  }

  confirmDistribution(data: Omit<Distribution, 'id' | 'timestamp'>): Distribution {
    const distribution: Distribution = {
      ...data,
      id: `DIST-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    this.distributions.set(distribution.id, distribution);
    if (this.repository) {
      void this.repository.saveDistribution(distribution).catch((err: unknown) => {
        console.error("[Solidarity] Failed to persist distribution:", err);
      });
    }
    return distribution;
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
}
