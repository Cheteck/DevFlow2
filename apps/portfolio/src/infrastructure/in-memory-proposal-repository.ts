import type { Proposal, ProposalStatus } from "../domain/proposal.js";
import type { ProposalRepository } from "../domain/proposal-repository.js";

export class InMemoryProposalRepository implements ProposalRepository {
  private proposals = new Map<string, Proposal>();

  async findById(id: string): Promise<Proposal | null> {
    return this.proposals.get(id) ?? null;
  }

  async save(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }

  async update(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }

  async findBySpace(spaceId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).filter((p) => p.spaceId === spaceId);
  }

  async findByStatus(status: ProposalStatus): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).filter((p) => p.status === status);
  }

  async listAll(): Promise<Proposal[]> {
    return Array.from(this.proposals.values());
  }
}
