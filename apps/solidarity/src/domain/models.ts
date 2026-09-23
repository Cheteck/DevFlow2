export interface Incident {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'FIRE' | 'FLOOD' | 'EARTHQUAKE' | 'STORM' | 'COLD_WAVE' | 'LANDSLIDE' | 'INDUSTRIAL_ACCIDENT' | 'OTHER';
  status: 'DECLARED' | 'ACTIVE' | 'CONTAINED' | 'RESOLVED' | 'ARCHIVED';
  severityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  geoZone: string;
  startDate: string;
  endDate?: string;
  coordinatingOrgId: string;
}

export interface Need {
  id: string;
  incidentId: string;
  requesterId: string;
  type: 'FOOD' | 'WATER' | 'CLOTHING' | 'BLANKET' | 'MEDICAL' | 'HYGIENE' | 'BABY' | 'SHELTER' | 'TRANSPORT' | 'HOUSING' | 'EQUIPMENT' | 'FINANCIAL' | 'VOLUNTEER' | 'OTHER';
  quantityRequired: number;
  quantitySatisfied: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedPeopleCount: number;
  geoZone: string;
  status: 'OPEN' | 'MATCHED' | 'PARTIALLY_SATISFIED' | 'SATISFIED' | 'CANCELLED';
  createdAt: string;
}

export interface Donation {
  id: string;
  donorId: string;
  donorType: 'CITIZEN' | 'ORGANIZATION' | 'MERCHANT';
  itemType: string;
  quantity: number;
  geoZone: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED';
  createdAt: string;
}

export interface Resource {
  id: string;
  donationId?: string;
  ownerId: string;
  type: string;
  totalQuantity: number;
  availableQuantity: number;
  hubId: string;
  status: 'AVAILABLE' | 'ALLOCATED' | 'CONSUMED';
}

export interface Hub {
  id: string;
  spaceId: string;
  name: string;
  type: 'WAREHOUSE' | 'COLLECTION_CENTER' | 'DISTRIBUTION_CENTER' | 'SHELTER';
  capacityM3: number;
  trustLevel: 'UNVERIFIED' | 'IDENTITY_VERIFIED' | 'ORGANIZATION_VERIFIED' | 'TRUSTED';
  geoZone: string;
}

export interface Allocation {
  id: string;
  needId: string;
  resourceId: string;
  allocatedQuantity: number;
  allocatedAt: string;
  status: 'PROPOSED' | 'CONFIRMED' | 'EXECUTED';
}

export interface Mission {
  id: string;
  originHubId: string;
  destinationZone: string;
  carrierId: string;
  driverVolunteerId: string;
  status: 'CREATED' | 'ASSIGNED' | 'READY' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'DISTRIBUTED' | 'COMPLETED';
  totalWeightKg: number;
}

export interface Distribution {
  id: string;
  missionId: string;
  hubId: string;
  beneficiaryCount: number;
  distributedItems: Array<{ resourceType: string; quantity: number }>;
  proofKey: string;
  timestamp: string;
}

export interface Beneficiary {
  id: string;
  anonymizedHash: string;
  familySize: number;
  assignedZone: string;
}

export interface Volunteer {
  id: string;
  userId: string;
  skills: string[];
  availability: boolean;
}

export interface Verification {
  id: string;
  entityId: string;
  entityType: 'ORGANIZATION' | 'HUB' | 'CARRIER';
  trustLevel: 'UNVERIFIED' | 'IDENTITY_VERIFIED' | 'ORGANIZATION_VERIFIED' | 'TRUSTED';
  verifiedBy: string;
}

export interface RiskAssessment {
  id: string;
  targetEntityId: string;
  riskScore: number; // 0.00 to 1.00
  flags: string[];
}
