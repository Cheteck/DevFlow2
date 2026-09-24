import type { Proposal, ProposalStatus } from "./proposal.js";

export interface ProposalRepository {
  findById(id: string): Promise<Proposal | null>;
  save(proposal: Proposal): Promise<void>;
  update(proposal: Proposal): Promise<void>;
  findBySpace(spaceId: string): Promise<Proposal[]>;
  findByStatus(status: ProposalStatus): Promise<Proposal[]>;
  listAll(): Promise<Proposal[]>;
}
