export interface CitizenIdentifier {
  name: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface DepartmentDataRequest {
  departmentCode: string;
  citizenIdentifier: CitizenIdentifier;
  requestedCategories: string[];
}

export interface CanonicalCitizenData {
  name?: string;
  dateOfBirth?: string;
  registrationNumber?: string;
  qualification?: string;
  score?: string | number;
  [key: string]: unknown;
}

export interface IntegrationEngine {
  getCitizenData(request: DepartmentDataRequest): Promise<CanonicalCitizenData | null>;
  isDepartmentAvailable(departmentCode: string): Promise<boolean>;
}