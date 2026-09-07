import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';

import Integration, {
  ProtocolType,
  AuthType,
  AuthConfig,
  RequestConfig,
  ResponseConfig,
  FieldMapping
} from '../models/Integration';
import Department from '../models/Department';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';

interface CreateIntegrationBody {
  departmentId?: unknown;
  name?: unknown;
  protocol?: unknown;
  baseUrl?: unknown;
  authentication?: unknown;
  request?: unknown;
  response?: unknown;
  fieldMappings?: unknown;
  active?: unknown;
}

interface UpdateIntegrationBody {
  name?: unknown;
  protocol?: unknown;
  baseUrl?: unknown;
  authentication?: unknown;
  request?: unknown;
  response?: unknown;
  fieldMappings?: unknown;
  active?: unknown;
}

const router = Router();

const validProtocols: ProtocolType[] = ['REST', 'SOAP'];
const validAuthTypes: AuthType[] = ['NONE', 'API_KEY', 'JWT'];

function isValidProtocol(protocol: unknown): protocol is ProtocolType {
  return typeof protocol === 'string' && validProtocols.includes(protocol as ProtocolType);
}

function isValidAuthType(authType: unknown): authType is AuthType {
  return typeof authType === 'string' && validAuthTypes.includes(authType as AuthType);
}

function isValidAuthConfig(auth: unknown): auth is AuthConfig {
  if (typeof auth !== 'object' || auth === null) return false;
  const a = auth as Record<string, unknown>;
  return isValidAuthType(a.type);
}

function isValidRequestConfig(req: unknown): req is RequestConfig {
  if (typeof req !== 'object' || req === null) return false;
  const r = req as Record<string, unknown>;
  return typeof r.method === 'string' && r.method.trim().length > 0 &&
         typeof r.path === 'string' && r.path.trim().length > 0;
}

function isValidResponseConfig(res: unknown): res is ResponseConfig {
  if (typeof res !== 'object' || res === null) return false;
  const r = res as Record<string, unknown>;
  return typeof r.dataPath === 'string' && r.dataPath.trim().length > 0;
}

function isValidFieldMapping(fm: unknown): fm is FieldMapping {
  if (typeof fm !== 'object' || fm === null) return false;
  const f = fm as Record<string, unknown>;
  return typeof f.sourceField === 'string' && f.sourceField.trim().length > 0 &&
         typeof f.canonicalField === 'string' && f.canonicalField.trim().length > 0 &&
         (f.transform === undefined || ['uppercase', 'lowercase', 'trim', 'date', 'number'].includes(f.transform as string));
}

function isValidFieldMappings(fms: unknown): fms is FieldMapping[] {
  return Array.isArray(fms) && fms.every(isValidFieldMapping);
}

/*
 * Get all integrations
 * Admin only
 */
router.get(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const integrations = await Integration.find()
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 });
      return res.json({ integrations });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch integrations' });
    }
  }
);

/*
 * Get one integration
 * Admin only
 */
router.get(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid integration ID' });
    }

    try {
      const integration = await Integration.findById(id).populate('departmentId', 'name code');
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      return res.json({ integration });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch integration' });
    }
  }
);

/*
 * Create integration
 * Admin only
 */
router.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{}, {}, CreateIntegrationBody>, res: Response) => {
    const {
      departmentId,
      name,
      protocol,
      baseUrl,
      authentication,
      request,
      response,
      fieldMappings,
      active
    } = req.body;

    if (typeof departmentId !== 'string' || !mongoose.isValidObjectId(departmentId)) {
      return res.status(400).json({ message: 'A valid department ID is required' });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!isValidProtocol(protocol)) {
      return res.status(400).json({ message: 'Protocol must be REST or SOAP' });
    }

    if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return res.status(400).json({ message: 'Base URL is required' });
    }

    if (!isValidAuthConfig(authentication)) {
      return res.status(400).json({ message: 'Valid authentication configuration is required' });
    }

    if (!isValidRequestConfig(request)) {
      return res.status(400).json({ message: 'Valid request configuration is required' });
    }

    if (!isValidResponseConfig(response)) {
      return res.status(400).json({ message: 'Valid response configuration is required' });
    }

    if (fieldMappings !== undefined && !isValidFieldMappings(fieldMappings)) {
      return res.status(400).json({ message: 'Field mappings must be an array of valid field mapping objects' });
    }

    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ message: 'Active must be a boolean if provided' });
    }

    try {
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({ message: 'Referenced department not found' });
      }

      const integration = await Integration.create({
        departmentId,
        name: name.trim(),
        protocol,
        baseUrl: baseUrl.trim(),
        authentication,
        request,
        response,
        fieldMappings: fieldMappings ?? [],
        ...(active !== undefined && { active })
      });

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CONNECTOR_CREATED',
        resource: 'integration',
        resourceId: integration._id.toString(),
        department: department.code,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: integration.name,
          protocol: integration.protocol,
          baseUrl: integration.baseUrl,
          authType: integration.authentication.type,
          active: integration.active
        }
      });

      return res.status(201).json({
        message: 'Integration created successfully',
        integration
      });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to create integration' });
    }
  }
);

/*
 * Update integration
 * Admin only
 */
router.patch(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }, {}, UpdateIntegrationBody>, res: Response) => {
    const { id } = req.params;
    const {
      name,
      protocol,
      baseUrl,
      authentication,
      request,
      response,
      fieldMappings,
      active
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid integration ID' });
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'Name must be a non-empty string' });
    }

    if (protocol !== undefined && !isValidProtocol(protocol)) {
      return res.status(400).json({ message: 'Protocol must be REST or SOAP' });
    }

    if (baseUrl !== undefined && (typeof baseUrl !== 'string' || !baseUrl.trim())) {
      return res.status(400).json({ message: 'Base URL must be a non-empty string' });
    }

    if (authentication !== undefined && !isValidAuthConfig(authentication)) {
      return res.status(400).json({ message: 'Valid authentication configuration is required' });
    }

    if (request !== undefined && !isValidRequestConfig(request)) {
      return res.status(400).json({ message: 'Valid request configuration is required' });
    }

    if (response !== undefined && !isValidResponseConfig(response)) {
      return res.status(400).json({ message: 'Valid response configuration is required' });
    }

    if (fieldMappings !== undefined && !isValidFieldMappings(fieldMappings)) {
      return res.status(400).json({ message: 'Field mappings must be an array of valid field mapping objects' });
    }

    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ message: 'Active must be a boolean if provided' });
    }

    if (
      name === undefined &&
      protocol === undefined &&
      baseUrl === undefined &&
      authentication === undefined &&
      request === undefined &&
      response === undefined &&
      fieldMappings === undefined &&
      active === undefined
    ) {
      return res.status(400).json({ message: 'At least one field is required to update' });
    }

    try {
      const integration = await Integration.findById(id);
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      const previousActive = integration.active;

      if (name !== undefined) {
        integration.name = name.trim();
      }
      if (protocol !== undefined) {
        integration.protocol = protocol;
      }
      if (baseUrl !== undefined) {
        integration.baseUrl = baseUrl.trim();
      }
      if (authentication !== undefined) {
        integration.authentication = authentication;
      }
      if (request !== undefined) {
        integration.request = request;
      }
      if (response !== undefined) {
        integration.response = response;
      }
      if (fieldMappings !== undefined) {
        integration.fieldMappings = fieldMappings;
      }
      if (active !== undefined) {
        integration.active = active;
      }

      await integration.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CONNECTOR_UPDATED',
        resource: 'integration',
        resourceId: integration._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: integration.name,
          protocol: integration.protocol,
          active: integration.active,
          activeChanged: active !== undefined && active !== previousActive
        }
      });

      if (active !== undefined && active !== previousActive) {
        await auditService.record({
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: active ? 'CONNECTOR_ENABLED' : 'CONNECTOR_DISABLED',
          resource: 'integration',
          resourceId: integration._id.toString(),
          requestId: req.requestId,
          outcome: 'SUCCESS',
          metadata: {
            name: integration.name
          }
        });
      }

      return res.json({
        message: 'Integration updated successfully',
        integration
      });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to update integration' });
    }
  }
);

/*
 * Delete integration
 * Admin only
 */
router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid integration ID' });
    }

    try {
      const integration = await Integration.findByIdAndDelete(id);
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CONNECTOR_DELETED',
        resource: 'integration',
        resourceId: id,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: integration.name,
          protocol: integration.protocol
        }
      });

      return res.json({ message: 'Integration deleted successfully' });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to delete integration' });
    }
  }
);

export default router;