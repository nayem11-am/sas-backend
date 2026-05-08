import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, clearNotifications } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);
router.delete('/', clearNotifications);

export default router;
