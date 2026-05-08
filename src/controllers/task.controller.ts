import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // PRIVACY FILTER:
    // 1. Admin (admin@saas.com) sees all tasks in the workspace.
    // 2. Others only see tasks assigned to them.
    const whereClause: any = {
      workspaceId: workspaceId,
    };

    const isSystemAdmin = user.email === 'admin@saas.com';
    const isAdminRole = user.role?.toUpperCase() === 'ADMIN';

    if (!isSystemAdmin && !isAdminRole) {
      // User is a member, filter by assigneeId
      whereClause.assigneeId = user.id;
    }

    const tasks = await (prisma as any).task.findMany({
      where: whereClause,
      include: {
        assignee: {
          select: {
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { title, description, status, priority, dueDate, goalId, assigneeId } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const normalizedStatus = (status || 'TODO').toUpperCase();
    const normalizedPriority = (priority || 'MEDIUM').toUpperCase();

    const task = await (prisma as any).task.create({
      data: {
        title,
        description,
        status: normalizedStatus,
        priority: normalizedPriority,
        dueDate: dueDate ? new Date(dueDate) : null,
        workspaceId,
        goalId: goalId || null,
        assigneeId: assigneeId || null,
        creatorId: user.id,
      },
      include: {
        assignee: {
          select: {
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (req.io) {
      req.io.to(workspaceId).emit('content:updated', {
        type: 'task',
        action: 'created',
        title: task.title,
        userName: user.fullName || user.email,
      });
    }

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const existingTask = await (prisma as any).task.findUnique({ where: { id: taskId } });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: existingTask.workspaceId, userId: user.id }
    });

    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    if (updates.status) updates.status = updates.status.toUpperCase();
    if (updates.priority) updates.priority = updates.priority.toUpperCase();

    const isSystemAdmin = user.email === 'admin@saas.com';
    const isAdminRole = membership.role?.toUpperCase() === 'ADMIN';

    if (!isSystemAdmin && !isAdminRole && existingTask.assigneeId !== user.id) {
       return res.status(403).json({ error: 'You can only update your own tasks' });
    }

    const task = await (prisma as any).task.update({
      where: { id: taskId },
      data: updates,
    });

    if (req.io) {
      req.io.to(task.workspaceId).emit('content:updated', {
        type: 'task',
        action: updates.status === 'COMPLETED' ? 'completed' : 'updated',
        title: task.title,
        userName: user.fullName || user.email,
      });
    }

    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const existingTask = await (prisma as any).task.findUnique({ where: { id: taskId } });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: existingTask.workspaceId, userId: user.id }
    });

    const isSystemAdmin = user.email === 'admin@saas.com';
    const isAdminRole = membership?.role?.toUpperCase() === 'ADMIN';

    if (!isSystemAdmin && !isAdminRole) {
      return res.status(403).json({ error: 'Only admins can delete tasks' });
    }

    await (prisma as any).task.delete({
      where: { id: taskId },
    });

    if (req.io) {
      req.io.to(existingTask.workspaceId).emit('content:updated', {
        type: 'task',
        action: 'deleted',
        title: existingTask.title,
        userName: user.fullName || user.email,
      });
    }

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
