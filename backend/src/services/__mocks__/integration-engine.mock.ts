import { IntegrationEngine, DepartmentDataRequest, CanonicalCitizenData } from '../integration-engine.interface';

const DEMO_CITIZENS: Record<string, CanonicalCitizenData> = {
  'rahul': {
    name: 'Rahul Kumar',
    dateOfBirth: '1995-03-15',
    registrationNumber: 'EDU2024001234',
    qualification: 'Bachelor of Technology',
    score: 85.5
  },
  'priya': {
    name: 'Priya Sharma',
    dateOfBirth: '1993-07-22',
    registrationNumber: 'EDU2023005678',
    qualification: 'Master of Science',
    score: 92.0
  }
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

function findDemoCitizen(name: string | undefined): CanonicalCitizenData | null {
  if (!name) return null;
  const normalized = normalizeName(name);
  const direct = DEMO_CITIZENS[normalized];
  if (direct) return direct;
  
  for (const [key, value] of Object.entries(DEMO_CITIZENS)) {
    if (value.name && normalizeName(value.name) === normalized) {
      return value;
    }
  }
  return null;
}

export class MockIntegrationEngine implements IntegrationEngine {
  async getCitizenData(request: DepartmentDataRequest): Promise<CanonicalCitizenData | null> {
    const { departmentCode, citizenIdentifier, requestedCategories } = request;

    const demoCitizen = findDemoCitizen(citizenIdentifier.name);

    if (!demoCitizen) {
      return null;
    }

    if (departmentCode === 'EDUCATION' && requestedCategories.includes('education')) {
      return {
        ...demoCitizen,
        qualification: demoCitizen.qualification || 'Bachelor of Technology',
        score: demoCitizen.score ?? 85.5
      };
    }

    if (departmentCode === 'EMPLOYMENT' && requestedCategories.includes('employment')) {
      return {
        ...demoCitizen,
        qualification: demoCitizen.qualification || 'Bachelor of Technology',
        score: demoCitizen.score ?? 85.5
      };
    }

    return null;
  }

  async isDepartmentAvailable(departmentCode: string): Promise<boolean> {
    return ['EDUCATION', 'EMPLOYMENT'].includes(departmentCode.toUpperCase());
  }
}

export const mockIntegrationEngine = new MockIntegrationEngine();