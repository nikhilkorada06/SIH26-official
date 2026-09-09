import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import authenticateToken from '../middleware/auth';
import Notification from '../models/Notification';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  const notifications = await Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ userId: req.user!.id, read: false });
  return res.json({ notifications, unreadCount });
});

router.patch('/read-all', async (req: Request, res: Response) => {
  await Notification.updateMany({ userId: req.user!.id, read: false }, { $set: { read: true, readAt: new Date() } });
  return res.json({ message: 'Notifications marked as read' });
});

router.patch('/:id/read', async (req: Request<{ id: string }>, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid notification ID' });
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.id },
    { $set: { read: true, readAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  return res.json({ notification });
});

export default router;
