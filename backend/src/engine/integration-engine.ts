import { IntegrationEngine, DepartmentDataRequest, CanonicalCitizenData } from '../services/integration-engine.interface';
import { ProtocolAdapter } from './adapters/adapter.interface';
import { RestAdapter } from './adapters/rest.adapter';
import { SoapAdapter } from './adapters/soap.adapter';
import { createAuthStrategy, AuthStrategy } from './auth/auth-strategy.interface';
import { httpClient } from './http/http-client';
import { ResponseParser } from './parsing/response-parser';
import { FieldMapper } from './parsing/field-mapper';
import Department from '../models/Department';
import Integration, { IntegrationDocument } from '../models/Integration';
import { EngineError } from './errors/engine-errors';
import { auditService } from '../audit/audit.service';

interface AdapterDependencies {
  httpClient: typeof httpClient;
  authStrategy: AuthStrategy;
  responseParser: { parse: (response: { data: unknown; headers: Record<string, string> }, integration: IntegrationDocument) => Promise<{ data: unknown }> };
  fieldMapper: typeof FieldMapper;
}

export class IntegrationEngineImpl implements IntegrationEngine {
  private readonly adapters: Map<string, ProtocolAdapter> = new Map();
  private readonly deps: AdapterDependencies;

  constructor() {
    this.adapters.set('REST', new RestAdapter());
    this.adapters.set('SOAP', new SoapAdapter());

    this.deps = {
      httpClient,
      authStrategy: createAuthStrategy('NONE'), // Will be overridden per request
      responseParser: ResponseParser,
      fieldMapper: FieldMapper,
    };
  }

  async getCitizenData(request: DepartmentDataRequest): Promise<CanonicalCitizenData | null> {
    const department = await Department.findOne({ code: request.departmentCode.toUpperCase(), active: true });
    if (!department) {
      throw EngineError.configuration(`Department not found or inactive: ${request.departmentCode}`);
    }

    const integration = await Integration.findOne({ departmentId: department._id, active: true })
      .populate('departmentId');
    if (!integration) {
      throw EngineError.configuration(`No active integration for department: ${request.departmentCode}`);
    }

    this.validateIntegration(integration);

    const adapter = this.adapters.get(integration.protocol);
    if (!adapter) {
      throw EngineError.unsupportedProtocol(integration.protocol);
    }

    const authStrategy = createAuthStrategy(integration.authentication.type);

    try {
      const result = await adapter.execute(integration, request, {
        ...this.deps,
        authStrategy,
      });

      return result;
    } catch (error: unknown) {
      await auditService.record({
        action: 'INTEGRATION_FAILED',
        resource: 'integration',
        resourceId: integration._id.toString(),
        department: request.departmentCode,
        outcome: 'FAILURE',
        metadata: {
          protocol: integration.protocol,
          error: error instanceof Error ? error.message : 'Unknown integration error'
        }
      });
      throw error;
    }
  }

  async isDepartmentAvailable(departmentCode: string): Promise<boolean> {
    try {
      const department = await Department.findOne({ code: departmentCode.toUpperCase(), active: true });
      if (!department) return false;

      const integration = await Integration.findOne({ departmentId: department._id, active: true });
      if (!integration) return false;

      return this.adapters.has(integration.protocol);
    } catch {
      return false;
    }
  }

  private validateIntegration(integration: IntegrationDocument): void {
    const req = integration.request;

    if (!req.method || !req.path) {
      throw EngineError.configuration('Request configuration missing method or path', { integrationId: integration._id });
    }

    if (integration.protocol === 'SOAP' && !req.soapAction) {
      throw EngineError.configuration('SOAP integration missing soapAction', { integrationId: integration._id });
    }

    const authType = integration.authentication.type;
    if (authType === 'API_KEY' && (!integration.authentication.apiKey?.headerName || !integration.authentication.apiKey?.value)) {
      throw EngineError.configuration('API_KEY authentication missing headerName or value', { integrationId: integration._id });
    }

    if (authType === 'JWT' && (!integration.authentication.jwt?.tokenUrl || !integration.authentication.jwt?.clientId || !integration.authentication.jwt?.clientSecret)) {
      throw EngineError.configuration('JWT authentication missing required fields', { integrationId: integration._id });
    }

    if (!integration.response?.dataPath) {
      throw EngineError.configuration('Response configuration missing dataPath', { integrationId: integration._id });
    }
  }
}

export const integrationEngine = new IntegrationEngineImpl();