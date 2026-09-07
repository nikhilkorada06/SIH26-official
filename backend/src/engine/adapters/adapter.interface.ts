import { DepartmentDataRequest, CanonicalCitizenData } from '../../services/integration-engine.interface';
import { IntegrationDocument } from '../../models/Integration';

export interface AdapterDependencies {
  httpClient: { request: (config: { method: string; url: string; headers?: Record<string, string>; params?: Record<string, string>; data?: unknown }) => Promise<{ status: number; headers: Record<string, string>; data: unknown }> };
  authStrategy: { prepare: (config: IntegrationDocument['authentication']) => Promise<{ headers: Record<string, string> }> };
  responseParser: { parse: (response: { data: unknown; headers: Record<string, string> }, integration: IntegrationDocument) => Promise<{ data: unknown }> };
  fieldMapper: { map: (sourceData: unknown, fieldMappings: IntegrationDocument['fieldMappings']) => CanonicalCitizenData };
}

export interface ProtocolAdapter {
  execute(
    integration: IntegrationDocument,
    request: DepartmentDataRequest,
    deps: AdapterDependencies
  ): Promise<CanonicalCitizenData | null>;
}