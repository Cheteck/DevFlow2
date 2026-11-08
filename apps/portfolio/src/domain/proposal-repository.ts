import type { Proposal, ProposalStatus } from "./proposal.js";

export interface ProposalRepository {
  findById(id: string, tenantId: string): Promise<Proposal | null>;
  save(proposal: Proposal, tenantId: string): Promise<void>;
  update(proposal: Proposal, tenantId: string): Promise<void>;
  /**
   * Update with optimistic locking.
   * Returns true if updated, false if version mismatch (concurrent modification).
   * The versionField is checked atomically in the WHERE clause.
   */
  updateWithVersionCheck(proposal: Proposal, versionField: { name: string; expectedValue: string }, tenantId: string): Promise<boolean>;
  findBySpace(spaceId: string, tenantId: string): Promise<Proposal[]>;
  findByStatus(status: ProposalStatus, tenantId: string): Promise<Proposal[]>;
  listAll(tenantId: string): Promise<Proposal[]>;
}
