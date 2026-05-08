import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getNotifications = async (req: any, res: Response): Promise<void> => {
  try {
    const notifications = await (prisma as any).notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await (prisma as any).notification.update({
      where: { id },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const markAllAsRead = async (req: any, res: Response): Promise<void> => {
  try {
    await (prisma as any).notification.updateMany({
      where: { userId: req.user.id },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const clearNotifications = async (req: any, res: Response): Promise<void> => {
  try {
    await (prisma as any).notification.deleteMany({
      where: { userId: req.user.id }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
