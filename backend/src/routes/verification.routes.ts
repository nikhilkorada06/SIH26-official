import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';

import Application from '../models/Application';
import Verification from '../models/Verification';
import Department from '../models/Department';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { verificationRateLimiter } from '../middleware/rate-limiter';
import { VerificationService, VerificationError } from '../services/verification.service';
import { integrationEngine } from '../engine/integration-engine';
import { entityMatcher } from '../services/entity-matcher';

const router = Router();

const verificationService = new VerificationService({
  integrationEngine,
  entityMatcher
});

function handleVerificationError(error: unknown, res: Response): void {
  if (error instanceof VerificationError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: 'Internal server error' });
}

router.post(
  '/:id/verify',
  verificationRateLimiter,
  authenticateToken,
  requireRole('admin', 'department_officer'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    try {
      const application = await Application.findById(id);
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      const { requestedCategories, departmentCodes } = await determineVerificationConfig(application.department);

      const result = await verificationService.verifyApplication(
        id,
        requestedCategories,
        departmentCodes,
        {
          actorId: req.user?.id,
          actorRole: req.user?.role,
          requestId: req.requestId
        }
      );
      return res.status(200).json({
        message: 'Verification completed',
        ...result
      });
    } catch (error: unknown) {
      handleVerificationError(error, res);
    }
  }
);

async function determineVerificationConfig(departmentName: string): Promise<{ requestedCategories: string[]; departmentCodes: string[] }> {
  const escaped = escapeRegExp(departmentName.trim());
  let department = await Department.findOne({
    active: true,
    name: { $regex: new RegExp(`^${escaped}$`, 'i') }
  });

  if (!department) {
    department = await Department.findOne({
      active: true,
      name: { $regex: new RegExp(`^${escaped}`, 'i') }
    });
  }

  if (!department) {
    department = await Department.findOne({
      active: true,
      code: departmentName.toUpperCase()
    });
  }

  if (!department) {
    throw new VerificationError(`No active department matches "${departmentName}"`, 404);
  }

  return {
    departmentCodes: [department.code],
    requestedCategories:
      department.dataCategories && department.dataCategories.length > 0
        ? department.dataCategories
        : [department.code.toLowerCase()]
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get(
  '/:id/verification',
  authenticateToken,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    try {
      const application = await Application.findById(id).select('citizenId status');
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      const isOwner = req.user?.role === 'citizen' && application.citizenId.toString() === req.user.id;
      const isOfficerOrAdmin = req.user?.role === 'admin' || req.user?.role === 'department_officer';

      if (!isOwner && !isOfficerOrAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const verification = await Verification.findOne({ applicationId: id })
        .sort({ createdAt: -1 })
        .select('status matched confidence sourceDepartment verifiedAt failureReason createdAt');

      if (!verification) {
        return res.status(404).json({ message: 'No verification attempt found' });
      }

      return res.json({
        applicationId: id,
        applicationStatus: application.status,
        verification: {
          id: verification._id.toString(),
          status: verification.status,
          matched: verification.matched,
          confidence: verification.confidence,
          sourceDepartment: verification.sourceDepartment,
          verifiedAt: verification.verifiedAt,
          failureReason: verification.failureReason,
          createdAt: verification.createdAt
        }
      });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch verification status' });
    }
  }
);

router.get(
  '/:id/verifications',
  authenticateToken,
  requireRole('admin', 'department_officer'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    try {
      const verifications = await Verification.find({ applicationId: id })
        .sort({ createdAt: -1 })
        .select('status matched confidence sourceDepartment verifiedAt failureReason createdAt');

      return res.json({ verifications });
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Failed to fetch verification history' });
    }
  }
);

export default router;