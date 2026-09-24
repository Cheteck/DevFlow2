export interface SpaceCohortMetric {
  cohortMonth: string;
  initialMembers: number;
  retainedMonth1: number;
  retainedMonth3: number;
}

export class SpaceAnalyticsEngine {
  static computeRetention(cohort: SpaceCohortMetric): { m1RetentionRate: number; m3RetentionRate: number } {
    if (cohort.initialMembers === 0) return { m1RetentionRate: 0, m3RetentionRate: 0 };
    return {
      m1RetentionRate: Math.round((cohort.retainedMonth1 / cohort.initialMembers) * 100),
      m3RetentionRate: Math.round((cohort.retainedMonth3 / cohort.initialMembers) * 100),
    };
  }
}

export interface ScimUserResource {
  schemas: string[];
  id: string;
  userName: string;
  name?: { formatted?: string; familyName?: string; givenName?: string };
  emails?: Array<{ value: string; primary?: boolean }>;
  active: boolean;
}

export class ScimEnterpriseManager {
  static parseScimUser(payload: unknown): ScimUserResource {
    const raw = payload as Record<string, unknown>;
    return {
      schemas: Array.isArray(raw.schemas) ? (raw.schemas as string[]) : ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: String(raw.id ?? ""),
      userName: String(raw.userName ?? ""),
      active: Boolean(raw.active ?? true),
      emails: Array.isArray(raw.emails) ? (raw.emails as Array<{ value: string; primary?: boolean }>) : [],
    };
  }
}

export interface SamlSsoConfig {
  spaceId: string;
  entityId: string;
  acsUrl: string;
  idpMetadataUrl?: string;
  certificateFingerprint: string;
  enabled: boolean;
}

export class SamlSsoConfigManager {
  private configs = new Map<string, SamlSsoConfig>();

  setSsoConfig(config: SamlSsoConfig): void {
    this.configs.set(config.spaceId, config);
  }

  getSsoConfig(spaceId: string): SamlSsoConfig | undefined {
    return this.configs.get(spaceId);
  }
}
