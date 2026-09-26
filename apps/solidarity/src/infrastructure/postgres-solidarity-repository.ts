/**
 * @apps/solidarity — PostgreSQL adapter for SolidarityService.
 * Implements persistence for all solidarity domain entities.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { Incident, Need, Donation, Resource, Hub, Mission, Distribution } from "../domain/models";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function hydrate<T>(data: unknown): T {
  const raw = typeof data === "string" ? (JSON.parse(data) as T) : (data as T);
  return raw;
}

export class PostgresSolidarityRepository {
  constructor(private readonly db: DatabasePort) {}

  async saveIncident(incident: Incident): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_incidents (id, code, type, status, "severityLevel", "geoZone", "coordinatingOrgId", data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = $4, "severityLevel" = $5, data = $8`,
      [
        incident.id,
        incident.code,
        incident.type,
        incident.status,
        incident.severityLevel,
        incident.geoZone,
        incident.coordinatingOrgId,
        JSON.stringify(incident),
      ],
    );
  }

  async getIncidents(): Promise<Incident[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_incidents`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Incident>(r["data"])))
      .filter((i): i is Incident => i !== null);
  }

  async saveNeed(need: Need): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_needs (id, "incidentId", type, urgency, status, "quantitySatisfied", data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status = $5, "quantitySatisfied" = $6, data = $7`,
      [
        need.id,
        need.incidentId,
        need.type,
        need.urgency,
        need.status,
        need.quantitySatisfied,
        JSON.stringify(need),
      ],
    );
  }

  async getNeeds(): Promise<Need[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_needs`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Need>(r["data"])))
      .filter((n): n is Need => n !== null);
  }

  async saveDonation(donation: Donation): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_donations (id, "donorId", "itemType", quantity, "verificationStatus", data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "verificationStatus" = $5, data = $6`,
      [
        donation.id,
        donation.donorId,
        donation.itemType,
        donation.quantity,
        donation.verificationStatus,
        JSON.stringify(donation),
      ],
    );
  }

  async getDonations(): Promise<Donation[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_donations`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Donation>(r["data"])))
      .filter((d): d is Donation => d !== null);
  }

  async saveResource(resource: Resource): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_resources (id, "donationId", "ownerId", type, "totalQuantity", "availableQuantity", "hubId", status, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         "availableQuantity" = $6, status = $8, data = $9`,
      [
        resource.id,
        resource.donationId ?? null,
        resource.ownerId,
        resource.type,
        resource.totalQuantity,
        resource.availableQuantity,
        resource.hubId,
        resource.status,
        JSON.stringify(resource),
      ],
    );
  }

  async getResources(): Promise<Resource[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_resources`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Resource>(r["data"])))
      .filter((r): r is Resource => r !== null);
  }

  async saveHub(hub: Hub): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_hubs (id, "spaceId", name, type, "geoZone", data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, type = $4, data = $6`,
      [hub.id, hub.spaceId, hub.name, hub.type, hub.geoZone, JSON.stringify(hub)],
    );
  }

  async getHubs(): Promise<Hub[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_hubs ORDER BY data->>'name'`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Hub>(r["data"])))
      .filter((h): h is Hub => h !== null);
  }

  async saveMission(mission: Mission): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_missions (id, "originHubId", status, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         status = $3, data = $4`,
      [mission.id, mission.originHubId, mission.status, JSON.stringify(mission)],
    );
  }

  async getMissions(): Promise<Mission[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_missions`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Mission>(r["data"])))
      .filter((m): m is Mission => m !== null);
  }

  async saveDistribution(distribution: Distribution): Promise<void> {
    await this.db.query(
      `INSERT INTO solidarity_distributions (id, "missionId", "hubId", "beneficiaryCount", data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         "beneficiaryCount" = $4, data = $5`,
      [
        distribution.id,
        distribution.missionId,
        distribution.hubId,
        distribution.beneficiaryCount,
        JSON.stringify(distribution),
      ],
    );
  }

  async getDistributions(): Promise<Distribution[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT data FROM solidarity_distributions`);
    return rows
      .map((r) => (r["data"] === undefined ? null : hydrate<Distribution>(r["data"])))
      .filter((d): d is Distribution => d !== null);
  }

  /** Debug helper: raw row inspection. */
  describeRow(row: Record<string, unknown>): { id: string; keys: string[] } {
    const rec = asRecord(row["data"] ?? row);
    return { id: asString(rec["id"] ?? row["id"]), keys: Object.keys(rec) };
  }
}
