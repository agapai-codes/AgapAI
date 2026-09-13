import type { IncidentReport } from '../types/incident';

export async function purgeAllIncidents(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('agapai_incidents');
    localStorage.removeItem('agapai_dispatch_queue');
  }
  try {
    const res = await fetch('/api/incidents/reset', { method: 'POST' });
    const payload = await res.json();
    return res.ok && payload.success;
  } catch {
    return false;
  }
}

export const SIMULATION_DEMO_INCIDENTS: IncidentReport[] = [
  {
    id: 'INC-SIM-001',
    type: 'MEDICAL',
    urgency: 'CRITICAL',
    condition: 'Unconscious, severe external bleeding from head injury',
    injuriesSymptoms: ['Unconscious', 'Profuse Bleeding', 'Head Trauma'],
    vitals: { conscious: false, breathing: true, bleeding: true },
    peopleCount: 1,
    location: {
      landmarkText: 'Engineering Complex, 2nd Floor Hallway',
      coordinates: [124.2442, 8.2418],
      confidenceScore: 98,
    },
    hazards: ['Slippery wet floor', 'Exposed metal edge'],
    relevantContext: 'Citizen slipped on stairs, hit temple, unconscious.',
    timeReported: new Date(Date.now() - 3 * 60000).toISOString(),
    aiTriage: {
      assessedUrgency: 'CRITICAL',
      confidence: 0.96,
      contributingFactors: ['Unconsciousness', 'Active head bleeding'],
      rationaleNote: 'Life-threatening indicators detected: immediate hemorrhage control needed.',
    },
    firstAidGuidance: {
      title: 'FIRST-AID: SEVERE EXTERNAL BLEEDING',
      source: 'American Red Cross',
      steps: [
        'Apply firm, direct pressure with clean gauze.',
        'Do NOT remove saturated cloth — add more layers.',
        'Keep victim still; monitor airway continuously.',
      ],
      warnings: ['Do NOT move patient due to possible cervical spine trauma.'],
    },
    status: 'PRIORITIZED',
    assignedUnits: [],
    relatedReportIds: [],
  },
  {
    id: 'INC-SIM-002',
    type: 'ACCIDENT',
    urgency: 'HIGH',
    condition: 'Motorcycle collision with roadside barrier',
    injuriesSymptoms: ['Lacerations', 'Suspected Leg Fracture'],
    vitals: { conscious: true, breathing: true, bleeding: true },
    peopleCount: 2,
    location: {
      landmarkText: 'National Highway, Tibanga Overpass',
      coordinates: [124.2481, 8.2375],
      confidenceScore: 92,
    },
    hazards: ['Traffic congestion', 'Spilled motorcycle fuel'],
    relevantContext: 'Rider thrown off bike, conscious and communicating.',
    timeReported: new Date(Date.now() - 8 * 60000).toISOString(),
    aiTriage: {
      assessedUrgency: 'HIGH',
      confidence: 0.89,
      contributingFactors: ['Motor vehicle impact', 'Fuel leak nearby'],
      rationaleNote: 'High kinetic impact. Fracture immobilization and traffic diversion required.',
    },
    status: 'REVIEWING',
    assignedUnits: [],
    relatedReportIds: [],
  },
  {
    id: 'INC-SIM-003',
    type: 'FIRE',
    urgency: 'HIGH',
    condition: 'Electrical sparks and black smoke from transformer box',
    injuriesSymptoms: ['Smoke Inhalation'],
    vitals: { conscious: true, breathing: true, bleeding: false },
    peopleCount: 4,
    location: {
      landmarkText: 'Commercial strip near Pala-o Public Market',
      coordinates: [124.2545, 8.2250],
      confidenceScore: 95,
    },
    hazards: ['Live electrical lines', 'Structural combustible roof'],
    relevantContext: 'Store owners attempting to cut power breakers.',
    timeReported: new Date(Date.now() - 14 * 60000).toISOString(),
    aiTriage: {
      assessedUrgency: 'HIGH',
      confidence: 0.94,
      contributingFactors: ['Active fire spread', 'Hazardous grid infrastructure'],
      rationaleNote: 'Active high-voltage risk with immediate risk of commercial structure ignition.',
    },
    status: 'REVIEWING',
    assignedUnits: [],
    relatedReportIds: [],
  },
  {
    id: 'INC-SIM-004',
    type: 'VIOLENCE',
    urgency: 'MEDIUM',
    condition: 'Physical altercation in parking area',
    injuriesSymptoms: ['Contusions', 'Minor Facial Bruising'],
    vitals: { conscious: true, breathing: true, bleeding: false },
    peopleCount: 3,
    location: {
      landmarkText: 'City Plaza North Parking Lot',
      coordinates: [124.2405, 8.2285],
      confidenceScore: 88,
    },
    hazards: ['Uncontrolled crowd'],
    relevantContext: 'Security on site separating individuals.',
    timeReported: new Date(Date.now() - 25 * 60000).toISOString(),
    aiTriage: {
      assessedUrgency: 'MEDIUM',
      confidence: 0.85,
      contributingFactors: ['Physical assault reported', 'No weapons visible'],
      rationaleNote: 'No severe trauma or weapons indicated. Law enforcement response requested.',
    },
    status: 'PENDING',
    assignedUnits: [],
    relatedReportIds: [],
  },
];
