import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';

import Consent, {
  ConsentDataCategory
} from '../models/Consent';
import Application from '../models/Application';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';

interface CreateConsentBody {
  applicationId?: unknown;
  dataCategories?: unknown;
  expiresAt?: unknown;
}

const router = Router();

const validDataCategories: ConsentDataCategory[] = [
  'education',
  'employment'
];

function isDataCategory(
  category: unknown
): category is ConsentDataCategory {
  return (
    category === 'education' ||
    category === 'employment'
  );
}

/*
 * Create consent
 * Citizen only
 */
router.post(
  '/',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{}, {}, CreateConsentBody>,
    res: Response
  ) => {
    const {
      applicationId,
      dataCategories,
      expiresAt
    } = req.body;

    if (
      typeof applicationId !== 'string' ||
      !mongoose.isValidObjectId(applicationId)
    ) {
      return res.status(400).json({
        message: 'A valid application ID is required'
      });
    }

    if (
      !Array.isArray(dataCategories) ||
      dataCategories.length === 0 ||
      !dataCategories.every(isDataCategory)
    ) {
      return res.status(400).json({
        message:
          'At least one valid data category is required'
      });
    }

    let parsedExpiresAt: Date | undefined;

    if (expiresAt !== undefined) {
      if (
        typeof expiresAt !== 'string' ||
        !expiresAt.trim()
      ) {
        return res.status(400).json({
          message: 'Invalid expiration date'
        });
      }

      parsedExpiresAt = new Date(expiresAt);

      if (Number.isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({
          message: 'Invalid expiration date'
        });
      }

      if (parsedExpiresAt <= new Date()) {
        return res.status(400).json({
          message: 'Expiration date must be in the future'
        });
      }
    }

    try {
      const application = await Application.findOne({
        _id: applicationId,
        citizenId: req.user!.id
      });

      if (!application) {
        return res.status(404).json({
          message: 'Application not found'
        });
      }

      if (application.status === 'withdrawn') {
        return res.status(409).json({
          message:
            'Consent cannot be granted for a withdrawn application'
        });
      }

      const existingConsent = await Consent.findOne({
        citizenId: req.user!.id,
        applicationId
      });

      if (existingConsent) {
        return res.status(409).json({
          message:
            'Consent already exists for this application'
        });
      }

      const consent = await Consent.create({
        citizenId: req.user!.id,
        applicationId,
        dataCategories: [
          ...new Set(dataCategories)
        ],
        status: 'active',
        ...(parsedExpiresAt && {
          expiresAt: parsedExpiresAt
        })
      });

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CONSENT_GRANTED',
        resource: 'consent',
        resourceId: consent._id.toString(),
        applicationId,
        consentId: consent._id.toString(),
        purpose: 'Government data verification',
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          dataCategories: consent.dataCategories
        }
      });

      return res.status(201).json({
        message: 'Consent granted successfully',
        consent
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to create consent'
      });
    }
  }
);

/*
 * Get all consent records belonging to citizen
 */
router.get(
  '/',
  authenticateToken,
  requireRole('citizen'),
  async (req: Request, res: Response) => {
    try {
      const consents = await Consent.find({
        citizenId: req.user!.id
      }).sort({ createdAt: -1 });

      return res.json({
        consents
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch consent records'
      });
    }
  }
);

/*
 * Get consent for a specific application
 */
router.get(
  '/:applicationId',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ applicationId: string }>,
    res: Response
  ) => {
    const { applicationId } = req.params;

    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    try {
      const consent = await Consent.findOne({
        citizenId: req.user!.id,
        applicationId
      });

      if (!consent) {
        return res.status(404).json({
          message: 'Consent record not found'
        });
      }

      return res.json({
        consent
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to fetch consent'
      });
    }
  }
);

/*
 * Revoke consent
 */
router.patch(
  '/:applicationId/revoke',
  authenticateToken,
  requireRole('citizen'),
  async (
    req: Request<{ applicationId: string }>,
    res: Response
  ) => {
    const { applicationId } = req.params;

    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(400).json({
        message: 'Invalid application ID'
      });
    }

    try {
      const consent = await Consent.findOne({
        citizenId: req.user!.id,
        applicationId
      });

      if (!consent) {
        return res.status(404).json({
          message: 'Consent record not found'
        });
      }

      if (consent.status === 'revoked') {
        return res.status(409).json({
          message: 'Consent has already been revoked'
        });
      }

      consent.status = 'revoked';
      consent.revokedAt = new Date();

      await consent.save();

      await auditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CONSENT_REVOKED',
        resource: 'consent',
        resourceId: consent._id.toString(),
        applicationId,
        consentId: consent._id.toString(),
        purpose: 'Government data verification',
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          dataCategories: consent.dataCategories
        }
      });

      return res.json({
        message: 'Consent revoked successfully',
        consent
      });
    } catch (error: unknown) {
      return res.status(500).json({
        message: 'Failed to revoke consent'
      });
    }
  }
);

export default router;