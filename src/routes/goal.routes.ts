import { Router } from 'express';
import { getGoals, createGoal, updateMilestone, deleteGoal } from '../controllers/goal.controller';
import { authorizeWorkspace } from '../middleware/workspace';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/workspace/:workspaceId', authenticate, authorizeWorkspace, getGoals);
router.post('/workspace/:workspaceId', authenticate, authorizeWorkspace, createGoal);
router.patch('/milestone/:milestoneId', authenticate, updateMilestone);
router.delete('/:goalId', authenticate, deleteGoal);


export default router;
