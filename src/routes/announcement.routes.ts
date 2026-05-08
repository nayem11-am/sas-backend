import { Router } from 'express';
import { getAnnouncements, createAnnouncement, toggleReaction, addComment, deleteAnnouncement, pinAnnouncement } from '../controllers/announcement.controller';
import { authorizeWorkspace } from '../middleware/workspace';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/workspace/:workspaceId', authenticate, authorizeWorkspace, getAnnouncements);
router.post('/workspace/:workspaceId', authenticate, authorizeWorkspace, createAnnouncement);
router.post('/:announcementId/reaction', authenticate, toggleReaction);
router.post('/:announcementId/comment', authenticate, addComment);
router.delete('/:announcementId', authenticate, deleteAnnouncement);
router.patch('/:announcementId', authenticate, pinAnnouncement);


export default router;
