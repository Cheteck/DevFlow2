/**
 * @mosaix/plugin-engine/runtime — Capability Resolution & Dependency Injection
 */

import type { PluginManifest } from "../core/index.js";
import { PluginCapabilityEnforcer, type PluginCapabilityGrant, type PluginCapabilityTier } from "../plugin-capability-model.js";

export interface CapabilityDescriptor<T = unknown> {
  id: string;
  name: string;
  tier: PluginCapabilityTier;
  version: string;
  instance: T;
  description?: string;
}

export class CapabilityRegistry {
  private capabilities = new Map<string, CapabilityDescriptor>();

  register<T = unknown>(descriptor: CapabilityDescriptor<T>): void {
    this.capabilities.set(descriptor.id, descriptor);
  }

  get<T = unknown>(capabilityId: string): CapabilityDescriptor<T> | undefined {
    return this.capabilities.get(capabilityId) as CapabilityDescriptor<T> | undefined;
  }

  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  list(): readonly CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }

  unregister(capabilityId: string): boolean {
    return this.capabilities.delete(capabilityId);
  }
}

export interface CapabilityResolutionResult {
  resolved: boolean;
  injectedCapabilities: Record<string, unknown>;
  missingCapabilities: string[];
  deniedCapabilities: string[];
}

export class PluginCapabilityResolver {
  constructor(private readonly registry: CapabilityRegistry) {}

  resolve(
    manifest: PluginManifest,
    grants: PluginCapabilityGrant[] = []
  ): CapabilityResolutionResult {
    const required = manifest.requiresCapabilities ?? [];
    const injected: Record<string, unknown> = {};
    const missing: string[] = [];
    const denied: string[] = [];

    for (const capId of required) {
      const descriptor = this.registry.get(capId);
      if (!descriptor) {
        missing.push(capId);
        continue;
      }

      // Check tier permission with grants
      const isGranted = PluginCapabilityEnforcer.evaluateGrant(grants, descriptor.tier, capId);
      if (!isGranted) {
        denied.push(`${capId} (Tier: ${descriptor.tier})`);
        continue;
      }

      injected[capId] = descriptor.instance;
    }

    return {
      resolved: missing.length === 0 && denied.length === 0,
      injectedCapabilities: injected,
      missingCapabilities: missing,
      deniedCapabilities: denied,
    };
  }
}
