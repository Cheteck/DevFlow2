/**
 * @apps/imperia/domain — Maintenance Mode Service
 * FEAT-01: Mode Maintenance [CŒUR] (imperia + shell)
 */

export interface MaintenanceStatus {
  enabled: boolean;
  reason: string;
  estimatedDurationMinutes?: number;
  initiatedBy?: string;
  updatedAt: string;
  allowedRoles: string[];
}

export class MaintenanceService {
  private static instance: MaintenanceService;

  private status: MaintenanceStatus = {
    enabled: process.env.MOSAIX_MAINTENANCE_MODE === "true",
    reason: "Maintenance programmée de la plateforme MosaiX pour optimisation et mise à niveau des services.",
    estimatedDurationMinutes: 30,
    initiatedBy: "system",
    updatedAt: new Date().toISOString(),
    allowedRoles: ["platform-admin", "imperia", "super-admin", "admin"],
  };

  private listeners = new Set<(status: MaintenanceStatus) => void>();

  static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  isMaintenanceActive(): boolean {
    return this.status.enabled;
  }

  getMaintenanceStatus(): Readonly<MaintenanceStatus> {
    return Object.freeze({ ...this.status });
  }

  setMaintenanceMode(
    enabled: boolean,
    reason?: string,
    estimatedDurationMinutes?: number,
    initiatedBy?: string
  ): MaintenanceStatus {
    this.status = {
      ...this.status,
      enabled,
      reason: reason ?? this.status.reason,
      estimatedDurationMinutes: estimatedDurationMinutes ?? this.status.estimatedDurationMinutes,
      initiatedBy: initiatedBy ?? this.status.initiatedBy,
      updatedAt: new Date().toISOString(),
    };

    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch {
        // Suppress listener errors
      }
    }

    return this.getMaintenanceStatus();
  }

  isUserBypassed(role?: string, permissions: string[] = []): boolean {
    if (!role) return false;
    const normalizedRole = role.toLowerCase().trim();
    if (this.status.allowedRoles.includes(normalizedRole)) {
      return true;
    }
    return permissions.includes("platform:admin") || permissions.includes("imperia:admin");
  }

  onMaintenanceChanged(listener: (status: MaintenanceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const maintenanceService = MaintenanceService.getInstance();
