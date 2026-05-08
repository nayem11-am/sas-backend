import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const mapGoalStatus = (status: string): string => {
  const map: Record<string, string> = {
    'on_track': 'IN_PROGRESS',
    'at_risk': 'AT_RISK',
    'off_track': 'ON_HOLD',
    'completed': 'COMPLETED',
    'in_progress': 'IN_PROGRESS',
  };
  const normalized = (status || 'on_track').toLowerCase();
  return map[normalized] || 'IN_PROGRESS';
};

export const getGoals = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const whereClause: any = {
      workspaceId: workspaceId,
    };

    const isSystemAdmin = user.email === 'admin@saas.com';
    const isAdminRole = user.role?.toUpperCase() === 'ADMIN';

    if (!isSystemAdmin && !isAdminRole) {
      whereClause.assigneeId = user.id;
    }

    const goals = await (prisma as any).goal.findMany({
      where: whereClause,
      include: {
        milestones: true,
        assignee: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        owner: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(goals);
  } catch (err: any) {
    console.error('Get Goals Error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { title, description, status, dueDate, milestones, assigneeId } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    console.log('Creating goal with data:', { title, workspaceId, assigneeId });

    if (assigneeId) {
      const isMember = await (prisma as any).workspaceMember.findFirst({
        where: { workspaceId, userId: assigneeId },
      });
      if (!isMember) {
        return res.status(400).json({ error: 'Assignee is not a workspace member' });
      }
    }

    const goal = await (prisma as any).goal.create({
      data: {
        title,
        description,
        status: mapGoalStatus(status),
        dueDate: dueDate ? new Date(dueDate) : null,
        workspaceId,
        ownerId: user.id,
        assigneeId: assigneeId || null,
        milestones: {
          create: (milestones || [])
            .filter((m: any) => m && m.title)
            .map((m: any) => ({
              title: m.title,
              progress: 0,
            })),
        },
      },
      include: {
        milestones: true,
        assignee: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (req.io) {
      req.io.to(workspaceId).emit('content:updated', {
        type: 'goal',
        action: 'created',
        title: goal.title,
        userName: user.fullName || user.email,
      });
    }

    console.log('Goal created successfully:', goal.id);
    res.status(201).json(goal);
  } catch (err: any) {
    console.error('Create Goal Error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updateMilestone = async (req: AuthRequest, res: Response) => {
  try {
    const { milestoneId } = req.params;
    const { progress } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const milestone = await (prisma as any).milestone.findUnique({
      where: { id: milestoneId },
      include: { goal: true }
    });

    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: milestone.goal.workspaceId, userId: user.id }
    });

    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    const updatedMilestone = await (prisma as any).milestone.update({
      where: { id: milestoneId },
      data: { progress },
    });

    const allMilestones = await (prisma as any).milestone.findMany({
      where: { goalId: updatedMilestone.goalId },
    });

    const totalProgress = allMilestones.reduce((acc: number, m: any) => acc + m.progress, 0);
    const goalProgress = allMilestones.length > 0 ? Math.round(totalProgress / allMilestones.length) : 0;

    await (prisma as any).goal.update({
      where: { id: updatedMilestone.goalId },
      data: { progress: goalProgress },
    });

    if (req.io) {
      const goal = await (prisma as any).goal.findUnique({
        where: { id: updatedMilestone.goalId }
      });
      req.io.to(milestone.goal.workspaceId).emit('content:updated', {
        type: 'goal',
        action: goal.progress === 100 ? 'completed' : 'updated',
        title: goal.title,
        userName: user.fullName || user.email,
      });
    }

    res.json(updatedMilestone);
  } catch (err: any) {
    console.error('Update Milestone Error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { goalId } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const existingGoal = await (prisma as any).goal.findUnique({ where: { id: goalId } });
    if (!existingGoal) return res.status(404).json({ error: 'Goal not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: existingGoal.workspaceId, userId: user.id }
    });

    const isSystemAdmin = user.email === 'admin@saas.com';
    const isAdminRole = membership?.role?.toUpperCase() === 'ADMIN';

    if (!isSystemAdmin && !isAdminRole) {
      return res.status(403).json({ error: 'Only admins can delete goals' });
    }

    await (prisma as any).goal.delete({
      where: { id: goalId },
    });

    if (req.io) {
      req.io.to(existingGoal.workspaceId).emit('content:updated', {
        type: 'goal',
        action: 'deleted',
        title: existingGoal.title,
        userName: user.fullName || user.email,
      });
    }

    res.status(204).send();
  } catch (err: any) {
    console.error('Delete Goal Error:', err);
    res.status(500).json({ error: err.message });
  }
};
