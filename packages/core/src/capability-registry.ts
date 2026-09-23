/**
 * Capability Registry — single owner per capability.
 *
 * Tracks which application provides which capability, so capability
 * invocation (Flow B) can resolve a provider and enforce permission.
 * Supports versioning, availability lifecycle, dynamic discovery, and
 * optional structural input/output validation without external deps.
 */

import type { PayloadValidator } from "./event-schema-registry";
import { CapabilityError, RegistrationError } from "./kernel-errors";

export type CapabilityAvailability = "available" | "deprecated" | "removed";

export type { PayloadValidator };

export interface CapabilityEntry {
  id: string;
  ownerApp: string;
  version: string;
  entry: string;
  permissions: string[];
  availability?: CapabilityAvailability;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /**
   * Optional input contract. When present, `validateCapability` enforces it
   * before invocation (invariant #9). Absent → inputs are accepted
   * (backward-compatible with capabilities without a declared contract).
   */
  inputValidator?: PayloadValidator;
  /**
   * Optional output contract. When present, `validateOutput` enforces it after
   * invocation. Absent → outputs are accepted.
   */
  outputValidator?: PayloadValidator;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityEntry>();

  register(entry: CapabilityEntry): void {
    const key = `${entry.ownerApp}:${entry.id}`;
    if (this.capabilities.has(key)) {
      throw new RegistrationError(`Capability already registered: ${key}`, {
        capabilityId: entry.id,
        ownerApp: entry.ownerApp,
      });
    }
    this.capabilities.set(key, entry);
  }

  resolve(id: string, version?: string): CapabilityEntry | undefined {
    // Deterministic: stable sort by ownerApp so multi-owner resolution is stable.
    const candidates = Array.from(this.capabilities.values())
      .filter((e) => e.id === id && (version === undefined || e.version === version))
      .sort((a, b) => a.ownerApp.localeCompare(b.ownerApp));
    return candidates[0];
  }

  get(
    id: string,
    ownerApp?: string,
    version?: string,
  ): CapabilityEntry | undefined {
    if (ownerApp !== undefined) {
      return this.capabilities.get(`${ownerApp}:${id}`);
    }
    return this.resolve(id, version);
  }

  /**
   * Bind (or refresh) the I/O contract of an existing capability without
   * clobbering its other fields (version, entry, permissions). Returns the
   * merged entry, or undefined when the capability is unknown.
   */
  bindContract(
    id: string,
    ownerApp: string,
    contract: {
      inputValidator?: PayloadValidator;
      outputValidator?: PayloadValidator;
    },
  ): CapabilityEntry | undefined {
    const existing = this.capabilities.get(`${ownerApp}:${id}`);
    if (!existing) return undefined;
    const updated: CapabilityEntry = {
      ...existing,
      ...(contract.inputValidator !== undefined
        ? { inputValidator: contract.inputValidator }
        : {}),
      ...(contract.outputValidator !== undefined
        ? { outputValidator: contract.outputValidator }
        : {}),
    };
    this.capabilities.set(`${ownerApp}:${id}`, updated);
    return updated;
  }

  listByOwner(ownerApp: string): CapabilityEntry[] {
    return Array.from(this.capabilities.values()).filter(
      (c) => c.ownerApp === ownerApp,
    );
  }

  list(): CapabilityEntry[] {
    return Array.from(this.capabilities.values());
  }

  clear(): void {
    this.capabilities.clear();
  }

  availableList(): CapabilityEntry[] {
    return this.list().filter((c) => {
      const availability = c.availability ?? "available";
      return availability === "available" || availability === "deprecated";
    });
  }

  listAvailable(id?: string): CapabilityEntry[] {
    const entries = this.availableList();
    if (id === undefined) return entries;
    return entries.filter((c) => c.id === id);
  }

  deprecate(capabilityId: string, reason?: string): void {
    void reason;
    const entry = this.resolve(capabilityId);
    if (!entry) return;
    entry.availability = "deprecated";
  }

  remove(capabilityId: string): void {
    const entry = this.resolve(capabilityId);
    if (!entry) return;
    entry.availability = "removed";
  }

  find(predicate: (entry: CapabilityEntry) => boolean): CapabilityEntry[] {
    return this.list().filter(predicate);
  }

  has(id: string): boolean {
    return this.resolve(id) !== undefined;
  }

  validateCapability(id: string, input?: unknown): boolean {
    const entry = this.resolve(id);
    if (!entry?.inputValidator) return true;
    return entry.inputValidator.safeParse(input).success;
  }

  validateOutput(id: string, output: unknown): boolean {
    const entry = this.resolve(id);
    if (!entry?.outputValidator) return true;
    return entry.outputValidator.safeParse(output).success;
  }

  async execute(capabilityId: string, _callerApp: string, _tenant: unknown, input: unknown): Promise<unknown> {
    const entry = this.resolve(capabilityId);
    if (!entry) {
      throw new CapabilityError(`Unknown capability: ${capabilityId}`, { capabilityId });
    }
    const executor = (entry as unknown as { executor?: (input: unknown) => unknown | Promise<unknown> }).executor;
    if (!executor) {
      throw new CapabilityError(
        `Capability [${capabilityId}] has no registered provider executor.`,
        { capabilityId },
      );
    }
    return executor(input);
  }
}
