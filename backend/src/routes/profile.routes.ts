import { Request, Response, Router } from 'express';
import authenticateToken from '../middleware/auth'; import requireRole from '../middleware/role'; import User from '../models/User'; import Application from '../models/Application'; import UploadedDocument from '../models/UploadedDocument';
const router = Router(); router.use(authenticateToken, requireRole('citizen'));
router.get('/', async (req: Request, res: Response) => { const user = await User.findById(req.user!.id).select('name email phone dateOfBirth registrationNumber college gender address district state pincode education category role isVerified').lean(); if (!user) return res.status(404).json({ message: 'Profile not found' }); const applicationCount = await Application.countDocuments({ citizenId: req.user!.id, applicationKind: 'employment' }); return res.json({ profile: user, applicationCount }); });
router.get('/documents', async (req: Request, res: Response) => { const documents = await UploadedDocument.find({ userId: req.user!.id }).select('-cloudinaryPublicId').sort({ uploadedAt: -1 }).lean(); return res.json({ documents }); });
export default router;
