import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';

import Application, {
  ApplicationStatus
} from '../models/Application';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';

interface CreateApplicationBody {
  jobId?: unknown;
  department?: unknown;
  position?: unknown;
}

interface UpdateApplicationBody {
  department?: unknown;
  position?: unknown;
}

interface UpdateStatusBody {
  status?: unknown;
}

const router = Router();

const citizenEditableStatuses: ApplicationStatus[] = [
  'submitted'
];

const officerStatuses: ApplicationStatus[] = [
  'under_review',
  'verified',
  'rejected'
];

function generateApplicationNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(1000 + Math.random() * 9000);

  return `APP-${timestamp}-${random}`;
}

function isValidApplicationStatus(
  status: unknown
): status is ApplicationStatus {
  return (
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'verified' ||
    status === 'rejected' ||
    status === 'withdrawn'
  );
}

/*
 * Create application
 * Citizen only
 */
router.post(
  '/',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{}, {}, CreateApplicationBody>,
    res: Response
  ) => {
    const { jobId, department, position } = req.body;

    if (
      typeof jobId !== 'string' ||
      !jobId.trim() ||
      typeof department !== 'string' ||
      !department.trim() ||
      typeof position !== 'string' ||
      !position.trim()
    ) {
      return res.status(400).json({
        message: 'Job ID, department, and position are required'
      });
    }

    try {
      const application = await Application.create({
        citizenId: req.user!.id,
        applicationNumber: generateApplicationNumber(),
        jobId: jobId.trim(),
        department: department.trim(),
        position: position.trim(),
        status: 'submitted'
      });

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'APPLICATION_CREATED',
        resource: 'application',
        resourceId: application._id.toString(),
        applicationId: application._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          applicationNumber: application.applicationNumber,
          department: application.department
        }
      });

      return res.status(201).json({
        message: 'Application submitted successfully',
        application
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to create application'
      });
    }
  }
);

/*
 * Get all applications belonging to authenticated citizen
 */
router.get(
  '/',
  authenticateToken,
  requireRole('citizen'),
  async (req: Request, res: Response) => {
    try {
      const applications = await Application.find({
        citizenId: req.user!.id
      }).sort({ createdAt: -1 });

      return res.json({
        applications
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch applications'
      });
    }
  }
);

/*
 * Get one application belonging to authenticated citizen
 */
router.get(
  '/:id',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ id: string }>,
    res: Response
  ) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    try {
      const application = await Application.findOne({
        _id: id,
        citizenId: req.user!.id
      });

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      return res.json({
        application
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch application'
      });
    }
  }
);

/*
 * Update citizen-owned application
 * Only submitted applications can be edited
 */
router.patch(
  '/:id',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ id: string }, {}, UpdateApplicationBody>,
    res: Response
  ) => {
    const { id } = req.params;
    const { department, position } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    if (
      department !== undefined &&
      (typeof department !== 'string' || !department.trim())
    ) {
      return res.status(400).json({
        message: 'Department must be a non-empty string'
      });
    }

    if (
      position !== undefined &&
      (typeof position !== 'string' || !position.trim())
    ) {
      return res.status(400).json({
        message: 'Position must be a non-empty string'
      });
    }

    if (department === undefined && position === undefined) {
      return res.status(400).json({
        message: 'At least one field is required to update'
      });
    }

    try {
      const application = await Application.findOne({
        _id: id,
        citizenId: req.user!.id
      });

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      if (!citizenEditableStatuses.includes(application.status)) {
        return res.status(409).json({
          message: 'Application can no longer be edited'
        });
      }

      if (department !== undefined) {
        application.department = department.trim();
      }

      if (position !== undefined) {
        application.position = position.trim();
      }

      await application.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'APPLICATION_UPDATED',
        resource: 'application',
        resourceId: application._id.toString(),
        applicationId: application._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          department: application.department,
          position: application.position
        }
      });

      return res.json({
        message: 'Application updated successfully',
        application
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to update application'
      });
    }
  }
);

/*
 * Withdraw application
 * Citizen only
 */
router.delete(
  '/:id',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ id: string }>,
    res: Response
  ) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    try {
      const application = await Application.findOne({
        _id: id,
        citizenId: req.user!.id
      });

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      if (application.status !== 'submitted') {
        return res.status(409).json({
          message: 'Only submitted applications can be withdrawn'
        });
      }

      application.status = 'withdrawn';
      await application.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'APPLICATION_STATUS_CHANGED',
        resource: 'application',
        resourceId: application._id.toString(),
        applicationId: application._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          previousStatus: 'submitted',
          newStatus: 'withdrawn'
        }
      });

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'APPLICATION_WITHDRAWN',
        resource: 'application',
        resourceId: application._id.toString(),
        applicationId: application._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS'
      });

      return res.json({
        message: 'Application withdrawn successfully',
        application
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to withdraw application'
      });
    }
  }
);

/*
 * Get application status
 * Citizen only
 */
router.get(
  '/:id/status',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ id: string }>,
    res: Response
  ) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    try {
      const application = await Application.findOne({
        _id: id,
        citizenId: req.user!.id
      }).select('applicationNumber status updatedAt');

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      return res.json({
        applicationNumber: application.applicationNumber,
        status: application.status,
        updatedAt: application.updatedAt
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch application status'
      });
    }
  }
);

/*
 * Get all applications
 * Admin / Department Officer
 */
router.get(
  '/all',
  authenticateToken,
  requireRole('admin', 'department_officer'),
  async (req: Request, res: Response) => {
    try {
      const applications = await Application.find()
        .sort({ createdAt: -1 });

      return res.json({
        applications
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch applications'
      });
    }
  }
);

/*
 * Update application status
 * Admin / Department Officer
 */
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole('admin', 'department_officer'),
  async (
    req: Request<{ id: string }, {}, UpdateStatusBody>,
    res: Response
  ) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    if (!isValidApplicationStatus(status)) {
      return res.status(400).json({
        message: 'Invalid application status'
      });
    }

    if (status === 'submitted' || status === 'withdrawn') {
      return res.status(400).json({
        message: 'This status cannot be assigned by an officer'
      });
    }

    try {
      const application = await Application.findById(id);

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      if (
        application.status === 'verified' ||
        application.status === 'rejected' ||
        application.status === 'withdrawn'
      ) {
        return res.status(409).json({
          message: 'Finalized applications cannot change status'
        });
      }

      if (
        application.status === 'submitted' &&
        status !== 'under_review'
      ) {
        return res.status(409).json({
          message: 'Application must first move to under_review'
        });
      }

      if (
        application.status === 'under_review' &&
        !officerStatuses.includes(status)
      ) {
        return res.status(409).json({
          message: 'Invalid status transition'
        });
      }

      const previousStatus = application.status;
      application.status = status;
      await application.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'APPLICATION_STATUS_CHANGED',
        resource: 'application',
        resourceId: application._id.toString(),
        applicationId: application._id.toString(),
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          previousStatus,
          newStatus: status
        }
      });

      if (status === 'verified') {
        await auditService.record({
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: 'APPLICATION_APPROVED',
          resource: 'application',
          resourceId: application._id.toString(),
          applicationId: application._id.toString(),
          requestId: req.requestId,
          outcome: 'SUCCESS'
        });
      }

      if (status === 'rejected') {
        await auditService.record({
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: 'APPLICATION_REJECTED',
          resource: 'application',
          resourceId: application._id.toString(),
          applicationId: application._id.toString(),
          requestId: req.requestId,
          outcome: 'SUCCESS'
        });
      }

      return res.json({
        message: 'Application status updated successfully',
        application
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to update application status'
      });
    }
  }
);
export default router;
