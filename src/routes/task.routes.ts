import { Router } from 'express';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/task.controller';
import { authorizeWorkspace } from '../middleware/workspace';
import { authenticate } from '../middleware/auth';


const router = Router();

router.get('/workspace/:workspaceId', authenticate, authorizeWorkspace, getTasks);
router.post('/workspace/:workspaceId', authenticate, authorizeWorkspace, createTask);

router.patch('/:taskId', authenticate, updateTask);
router.delete('/:taskId', authenticate, deleteTask);

export default router;
