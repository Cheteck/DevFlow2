import type { Proposal, ProposalStatus } from "../domain/proposal.js";
import type { ProposalRepository } from "../domain/proposal-repository.js";
import { InMemoryGuard } from "@mosaix/support";

export class InMemoryProposalRepository implements ProposalRepository {
  private proposals = new Map<string, { proposal: Proposal; tenantId: string }>();

  constructor() {
    InMemoryGuard.reportFallback("InMemoryProposalRepository");
  }

  async findById(id: string, tenantId: string): Promise<Proposal | null> {
    const entry = this.proposals.get(id);
    if (!entry || entry.tenantId !== tenantId) return null;
    // Return a deep copy to prevent external mutations from affecting stored state
    return JSON.parse(JSON.stringify(entry.proposal));
  }

  async save(proposal: Proposal, tenantId: string): Promise<void> {
    this.proposals.set(proposal.id, { proposal, tenantId });
  }

  async update(proposal: Proposal, tenantId: string): Promise<void> {
    const existing = this.proposals.get(proposal.id);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error(`Proposal ${proposal.id} not found or tenant mismatch`);
    }
    this.proposals.set(proposal.id, { proposal, tenantId });
  }

  async updateWithVersionCheck(proposal: Proposal, versionField: { name: string; expectedValue: string }, tenantId: string): Promise<boolean> {
    const existing = this.proposals.get(proposal.id);
    if (!existing || existing.tenantId !== tenantId) return false;

    const currentValue = (existing.proposal as Record<string, unknown>)[versionField.name] as string | undefined;
    if (currentValue !== versionField.expectedValue) {
      return false; // Concurrent modification detected
    }

    this.proposals.set(proposal.id, { proposal, tenantId });
    return true;
  }

  async findBySpace(spaceId: string, tenantId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter((entry) => entry.tenantId === tenantId && entry.proposal.spaceId === spaceId)
      .map((entry) => JSON.parse(JSON.stringify(entry.proposal)));
  }

  async findByStatus(status: ProposalStatus, tenantId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter((entry) => entry.tenantId === tenantId && entry.proposal.status === status)
      .map((entry) => JSON.parse(JSON.stringify(entry.proposal)));
  }

  async listAll(tenantId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter((entry) => entry.tenantId === tenantId)
      .map((entry) => JSON.parse(JSON.stringify(entry.proposal)));
  }
}
