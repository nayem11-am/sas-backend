import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getWorkspaceAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    // 1. Fetch Goals
    const goals = await (prisma as any).goal.findMany({
      where: { workspaceId },
      select: { status: true, progress: true }
    });

    // 2. Fetch Tasks
    const tasks = await (prisma as any).task.findMany({
      where: { workspaceId },
      select: { status: true }
    });

    // Calculate metrics
    const totalGoals = goals.length;
    const completedGoals = goals.filter((g: any) => 
      g.status === 'COMPLETED' || 
      g.status === 'completed' || 
      g.progress === 100
    ).length;
    const overdueGoals = goals.filter((g: any) => 
      g.status === 'AT_RISK' || 
      g.status === 'at_risk'
    ).length;
    const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    // Mock chart data for now
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mockCompleted = [2, 4, 1, 5, 3, 0, 2];
    const chartData = days.map((day, index) => ({
      date: day,
      completed: mockCompleted[index],
      active: tasks.filter((t: any) => t.status?.toUpperCase() === 'IN_PROGRESS').length,
    }));

    res.json({
      totalGoals,
      completedThisWeek: completedGoals,
      overdueGoals,
      completionRate,
      chartData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
