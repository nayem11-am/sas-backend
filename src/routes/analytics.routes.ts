import { Router } from 'express';
import { getWorkspaceAnalytics } from '../controllers/analytics.controller';
import { authorizeWorkspace } from '../middleware/workspace';
import { authenticate } from '../middleware/auth';


const router = Router();

router.get('/workspace/:workspaceId', authenticate, authorizeWorkspace, getWorkspaceAnalytics);


export default router;
