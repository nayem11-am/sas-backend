import { Router } from 'express';
import { 
  createWorkspace, 
  getMyWorkspaces, 
  getWorkspaceMembers, 
  removeMember,
  getUsersToInvite,
  sendInvitation,
  getMyInvitations,
  respondToInvitation
} from '../controllers/workspace.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createWorkspace);
router.get('/mine', authenticate, getMyWorkspaces);

// Invitation Routes
router.get('/invitations/my', authenticate, getMyInvitations);
router.post('/invitations/:invitationId/respond', authenticate, respondToInvitation);

// Workspace specific routes
router.get('/:workspaceId/members', authenticate, getWorkspaceMembers);
router.delete('/:workspaceId/members/:userId', authenticate, removeMember);

router.get('/:workspaceId/users-to-invite', authenticate, getUsersToInvite);
router.post('/:workspaceId/invite', authenticate, sendInvitation);

export default router;
