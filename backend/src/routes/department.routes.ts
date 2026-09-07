import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';

import Department from '../models/Department';
import Integration from '../models/Integration';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';

interface CreateDepartmentBody {
  name?: unknown;
  code?: unknown;
  description?: unknown;
  active?: unknown;
  dataCategories?: unknown;
}

interface UpdateDepartmentBody {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  dataCategories?: unknown;
}

const router = Router();

function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && code.trim().length > 0;
}

function isValidName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0;
}

function isValidDescription(desc: unknown): desc is string | undefined {
  return desc === undefined || (typeof desc === 'string' && desc.trim().length > 0);
}

function isValidActive(active: unknown): active is boolean {
  return typeof active === 'boolean';
}

function isValidDataCategories(dataCategories: unknown): dataCategories is string[] {
  return (
    Array.isArray(dataCategories) &&
    dataCategories.length > 0 &&
    dataCategories.every(cat => typeof cat === 'string' && cat.trim().length > 0)
  );
}

/*
 * Get all departments
 * Admin only
 */
router.get(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const departments = await Department.find().sort({ createdAt: -1 });
      return res.json({ departments });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch departments' });
    }
  }
);

/*
 * Get one department
 * Admin only
 */
router.get(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid department ID' });
    }

    try {
      const department = await Department.findById(id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      return res.json({ department });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch department' });
    }
  }
);

/*
 * Create department
 * Admin only
 */
router.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{}, {}, CreateDepartmentBody>, res: Response) => {
    const { name, code, description, active, dataCategories } = req.body;

    if (!isValidName(name)) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!isValidCode(code)) {
      return res.status(400).json({ message: 'Code is required' });
    }

    if (!isValidDescription(description)) {
      return res.status(400).json({ message: 'Description must be a non-empty string if provided' });
    }

    if (active !== undefined && !isValidActive(active)) {
      return res.status(400).json({ message: 'Active must be a boolean if provided' });
    }

    if (dataCategories !== undefined && !isValidDataCategories(dataCategories)) {
      return res.status(400).json({ message: 'dataCategories must be a non-empty array of non-empty strings' });
    }

    const normalizedCode = code.trim().toUpperCase();

    try {
      const existingDepartment = await Department.findOne({ code: normalizedCode });
      if (existingDepartment) {
        return res.status(409).json({ message: 'Department code already exists' });
      }

      const department = await Department.create({
        name: name.trim(),
        code: normalizedCode,
        ...(description && { description: description.trim() }),
        ...(active !== undefined && { active }),
        ...(dataCategories !== undefined && {
          dataCategories: dataCategories.map((cat: string) => cat.trim())
        })
      });

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DEPARTMENT_CREATED',
        resource: 'department',
        resourceId: department._id.toString(),
        department: department.code,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: department.name,
          code: department.code,
          active: department.active,
          dataCategories: department.dataCategories
        }
      });

      return res.status(201).json({
        message: 'Department created successfully',
        department
      });
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: 'Department code already exists' });
      }
      return res.status(500).json({ message: 'Failed to create department' });
    }
  }
);

/*
 * Update department
 * Admin only
 */
router.patch(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }, {}, UpdateDepartmentBody>, res: Response) => {
    const { id } = req.params;
    const { name, description, active, dataCategories } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid department ID' });
    }

    if (name !== undefined && !isValidName(name)) {
      return res.status(400).json({ message: 'Name must be a non-empty string' });
    }

    if (description !== undefined && !isValidDescription(description)) {
      return res.status(400).json({ message: 'Description must be a non-empty string if provided' });
    }

    if (active !== undefined && !isValidActive(active)) {
      return res.status(400).json({ message: 'Active must be a boolean if provided' });
    }

    if (dataCategories !== undefined && !isValidDataCategories(dataCategories)) {
      return res.status(400).json({ message: 'dataCategories must be a non-empty array of non-empty strings' });
    }

    if (name === undefined && description === undefined && active === undefined && dataCategories === undefined) {
      return res.status(400).json({ message: 'At least one field is required to update' });
    }

    try {
      const department = await Department.findById(id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }

      const previousActive = department.active;

      if (name !== undefined) {
        department.name = name.trim();
      }
      if (description !== undefined) {
        department.description = description.trim();
      }
      if (active !== undefined) {
        department.active = active;
      }
      if (dataCategories !== undefined) {
        department.dataCategories = dataCategories.map((cat: string) => cat.trim());
      }

      await department.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DEPARTMENT_UPDATED',
        resource: 'department',
        resourceId: department._id.toString(),
        department: department.code,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: department.name,
          active: department.active,
          activeChanged: active !== undefined && active !== previousActive,
          dataCategories: department.dataCategories
        }
      });

      return res.json({
        message: 'Department updated successfully',
        department
      });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to update department' });
    }
  }
);

/*
 * Delete department
 * Admin only
 * Reject if integrations reference this department
 */
router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid department ID' });
    }

    try {
      const integrationsCount = await Integration.countDocuments({ departmentId: id });
      if (integrationsCount > 0) {
        return res.status(409).json({
          message: 'Cannot delete department: integrations reference this department'
        });
      }

      const department = await Department.findByIdAndDelete(id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DEPARTMENT_DELETED',
        resource: 'department',
        resourceId: id,
        department: department.code,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          name: department.name,
          code: department.code
        }
      });

      return res.json({ message: 'Department deleted successfully' });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to delete department' });
    }
  }
);

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export default router;