import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';

/**
 * Middleware to verify if the authenticated user has access to a workspace.
 * Assumes the workspaceId is in req.params.workspaceId
 */
export const authorizeWorkspace = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    const { workspaceId } = req.params;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found in request' });
      return;
    }

    if (!workspaceId) {
      res.status(400).json({ error: 'Bad Request: Missing workspaceId parameter' });
      return;
    }

    // 🛡️ Senior Dev Tip: Always check membership in the DB, 
    // don't just rely on the workspaceId in the JWT, 
    // as it might be stale or the user might have been removed.
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspaceId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'Forbidden: You are not a member of this workspace' });
      return;
    }

    // Optional: Attach role to request for later use
    (req as any).workspaceRole = membership.role;

    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error during workspace authorization' });
  }
};

/**
 * Middleware to restrict access to ADMIN only roles in a workspace
 */
export const requireWorkspaceAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const role = (req as any).workspaceRole;

  if (role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
};
