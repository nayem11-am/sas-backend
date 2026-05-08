import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const announcements = await (prisma as any).announcement.findMany({
      where: { workspaceId },
      include: {
        author: {
          select: {
            fullName: true,
          },
        },
        reactions: true,
        comments: {
          include: {
            author: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(announcements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { content, isPinned } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId, userId: user.id }
    });

    if (!membership || membership.role?.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can create announcements' });
    }

    const announcement = await (prisma as any).announcement.create({
      data: {
        content,
        isPinned: isPinned || false,
        workspaceId,
        authorId: user.id,
        title: 'Announcement',
      },
    });

    if (req.io) {
      req.io.to(workspaceId).emit('content:updated', {
        type: 'announcement',
        action: 'created',
        title: 'New Announcement',
        userName: user.fullName || user.email,
      });
    }

    res.status(201).json(announcement);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { announcementId } = req.params;
    const { emoji } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const announcement = await (prisma as any).announcement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: announcement.workspaceId, userId: user.id }
    });

    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    const existingReaction = await (prisma as any).reaction.findFirst({
      where: {
        announcementId,
        userId: user.id,
        emoji,
      },
    });

    if (existingReaction) {
      await (prisma as any).reaction.delete({
        where: { id: existingReaction.id },
      });
      res.json({ message: 'Reaction removed' });
    } else {
      const reaction = await (prisma as any).reaction.create({
        data: {
          announcementId,
          userId: user.id,
          emoji,
        },
      });
      res.json(reaction);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { announcementId } = req.params;
    const { content } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const announcement = await (prisma as any).announcement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: announcement.workspaceId, userId: user.id }
    });

    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    const comment = await (prisma as any).comment.create({
      data: {
        content,
        announcementId,
        userId: user.id,
      },
      include: {
        author: {
          select: {
            fullName: true,
          },
        },
      },
    });

    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { announcementId } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const announcement = await (prisma as any).announcement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: announcement.workspaceId, userId: user.id }
    });

    if (membership?.role?.toUpperCase() !== 'ADMIN' && announcement.authorId !== user.id) {
      return res.status(403).json({ error: 'Only admins or the author can delete announcements' });
    }

    await (prisma as any).announcement.delete({
      where: { id: announcementId }
    });

    if (req.io) {
      req.io.to(announcement.workspaceId).emit('content:updated', {
        type: 'announcement',
        action: 'deleted',
        title: 'Announcement',
        userName: user.fullName || user.email,
      });
    }

    res.json({ message: 'Announcement deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const pinAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { announcementId } = req.params;
    const { isPinned } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const announcement = await (prisma as any).announcement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId: announcement.workspaceId, userId: user.id }
    });

    if (membership?.role?.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can pin announcements' });
    }

    const updated = await (prisma as any).announcement.update({
      where: { id: announcementId },
      data: { isPinned }
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
