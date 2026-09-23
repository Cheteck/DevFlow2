import { describe, it, expect } from 'vitest';
import { createSolidarityComposition } from '../src/composition-root.js';

describe('SolidarityBAC Domain Tests', () => {
  it('should manage incident, need, donation, mission, and distribution lifecycle', () => {
    const { solidarityService } = createSolidarityComposition();

    const incident = solidarityService.createIncident({
      code: 'INC-2026-0001',
      title: 'Jijel Wildfires',
      description: 'Emergency wildfire response in Jijel area',
      type: 'FIRE',
      severityLevel: 'CRITICAL',
      geoZone: 'Jijel',
      startDate: new Date().toISOString(),
      coordinatingOrgId: 'ORG-001'
    });
    expect(incident.id).toBeDefined();
    expect(incident.status).toBe('ACTIVE');

    const need = solidarityService.declareNeed({
      incidentId: incident.id,
      requesterId: 'USER-001',
      type: 'BLANKET',
      quantityRequired: 500,
      urgency: 'CRITICAL',
      affectedPeopleCount: 280,
      geoZone: 'Jijel'
    });
    expect(need.id).toBeDefined();
    expect(need.status).toBe('OPEN');

    const donation = solidarityService.submitDonation({
      donorId: 'DONOR-001',
      donorType: 'CITIZEN',
      itemType: 'BLANKET',
      quantity: 800,
      geoZone: 'Algiers'
    });
    expect(donation.id).toBeDefined();

    const hub = solidarityService.registerHub({
      spaceId: 'SPACE-001',
      name: 'Central Warehouse Algiers',
      type: 'WAREHOUSE',
      capacityM3: 1000,
      trustLevel: 'TRUSTED',
      geoZone: 'Algiers'
    });
    expect(hub.id).toBeDefined();

    const mission = solidarityService.assignMission({
      originHubId: hub.id,
      destinationZone: 'Jijel',
      carrierId: 'CARRIER-001',
      driverVolunteerId: 'VOLUNTEER-001',
      totalWeightKg: 1200
    });
    expect(mission.id).toBeDefined();
    expect(mission.status).toBe('IN_TRANSIT');

    const distribution = solidarityService.confirmDistribution({
      missionId: mission.id,
      hubId: hub.id,
      beneficiaryCount: 280,
      distributedItems: [{ resourceType: 'BLANKET', quantity: 500 }],
      proofKey: 'proofs/proof-001.jpg'
    });
    expect(distribution.id).toBeDefined();
  });
});
