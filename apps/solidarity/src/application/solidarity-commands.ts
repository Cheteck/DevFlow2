import type { Incident, Need, Donation, Hub, Mission, Distribution } from '../domain/models.js';

export class CreateIncidentCommand {
  static readonly commandName = "solidarity.incident.create";
  constructor(public readonly data: Omit<Incident, 'id' | 'status'>) {}
}

export class DeclareNeedCommand {
  static readonly commandName = "solidarity.need.declare";
  constructor(public readonly data: Omit<Need, 'id' | 'quantitySatisfied' | 'status' | 'createdAt'>) {}
}

export class SubmitDonationCommand {
  static readonly commandName = "solidarity.donation.submit";
  constructor(public readonly data: Omit<Donation, 'id' | 'verificationStatus' | 'createdAt'>) {}
}

export class VerifyDonationCommand {
  static readonly commandName = "solidarity.donation.verify";
  constructor(public readonly donationId: string, public readonly verifierId: string, public readonly status: 'VERIFIED' | 'UNVERIFIED') {}
}

export class RegisterHubCommand {
  static readonly commandName = "solidarity.hub.register";
  constructor(public readonly data: Omit<Hub, 'id'>) {}
}

export class AssignMissionCommand {
  static readonly commandName = "solidarity.mission.assign";
  constructor(public readonly data: Omit<Mission, 'id' | 'status'>) {}
}

export class ConfirmDistributionCommand {
  static readonly commandName = "solidarity.distribution.confirm";
  constructor(public readonly data: Omit<Distribution, 'id' | 'timestamp'>) {}
}
