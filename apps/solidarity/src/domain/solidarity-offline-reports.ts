export interface OfflineInterventionRecord {
  id: string;
  volunteerId: string;
  missionId: string;
  beneficiaryCount: number;
  timestamp: string;
  synced: boolean;
}

export class SolidarityOfflineSyncQueue {
  private queue: OfflineInterventionRecord[] = [];

  enqueue(record: Omit<OfflineInterventionRecord, "synced">): OfflineInterventionRecord {
    const item: OfflineInterventionRecord = { ...record, synced: false };
    this.queue.push(item);
    return item;
  }

  getPending(): OfflineInterventionRecord[] {
    return this.queue.filter((r) => !r.synced);
  }

  markSynced(id: string): void {
    const item = this.queue.find((r) => r.id === id);
    if (item) {
      item.synced = true;
    }
  }
}

export interface MissionChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  photoProofUrl?: string;
}

export class SolidarityMissionChecklistManager {
  static validateMissionCompletion(items: MissionChecklistItem[]): boolean {
    if (items.length === 0) return false;
    return items.every((i) => i.completed);
  }
}

export class OchaReportGenerator {
  static generateReport(data: {
    country: string;
    crisisType: string;
    affectedPopulation: number;
    beneficiariesServed: number;
  }): { title: string; ochaStandardPayload: Record<string, unknown> } {
    return {
      title: `OCHA SitRep - ${data.crisisType} (${data.country})`,
      ochaStandardPayload: {
        reportingAgency: "MosaiX Solidarity Cluster",
        isoCountry: data.country,
        crisisType: data.crisisType,
        hxlTags: {
          "#affected+num": data.affectedPopulation,
          "#reached+num": data.beneficiariesServed,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
