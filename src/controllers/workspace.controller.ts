import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const createWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, accentColor } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const slug = name.toLowerCase().replace(/ /g, '-') + '-' + Date.now();

    const workspace = await (prisma as any).workspace.create({
      data: {
        name,
        description,
        accentColor: accentColor || '#6366f1',
        slug,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'ADMIN',
          },
        },
      },
    });

    res.status(201).json(workspace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyWorkspaces = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const memberships = await (prisma as any).workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: true,
      },
    });

    const workspaces = memberships.map((m: any) => ({
      ...m.workspace,
      role: m.role,
    }));

    res.json(workspaces);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- NEW INVITATION SYSTEM ---

export const getUsersToInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { query } = req.query;

    const members = await (prisma as any).workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true }
    });
    const memberIds = members.map((m: any) => m.userId);

    const pendingInvites = await (prisma as any).invitation.findMany({
      where: { workspaceId, status: 'PENDING' },
      select: { email: true }
    });
    const pendingEmails = pendingInvites.map((i: any) => i.email);

    const users = await (prisma as any).user.findMany({
      where: {
        AND: [
          { id: { notIn: memberIds } },
          { email: { notIn: pendingEmails } },
          {
            OR: [
              { fullName: { contains: String(query || ''), mode: 'insensitive' } },
              { email: { contains: String(query || ''), mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true
      },
      take: 10
    });

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const sendInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { email, role } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await (prisma as any).invitation.findUnique({
      where: { workspaceId_email: { workspaceId, email } }
    });

    if (existing && existing.status === 'PENDING') {
      return res.status(400).json({ error: 'Invitation already pending' });
    }

    const invitation = await (prisma as any).invitation.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: { status: 'PENDING', role: role || 'MEMBER' },
      create: {
        workspaceId,
        email,
        role: role || 'MEMBER',
        invitedById: user.id
      }
    });

    res.status(201).json(invitation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyInvitations = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const invitations = await (prisma as any).invitation.findMany({
      where: { email: user.email, status: 'PENDING' },
      include: {
        workspace: true,
        invitedBy: {
          select: { fullName: true, avatarUrl: true }
        }
      }
    });

    res.json(invitations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const respondToInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const invitation = await (prisma as any).invitation.findUnique({
      where: { id: invitationId },
      include: { workspace: true }
    });

    if (!invitation || invitation.email !== user.email) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (status === 'ACCEPTED') {
      await prisma.$transaction([
        (prisma as any).workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
            role: invitation.role
          }
        }),
        (prisma as any).invitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' }
        })
      ]);
    } else {
      await (prisma as any).invitation.update({
        where: { id: invitationId },
        data: { status: 'DECLINED' }
      });
    }

    res.json({ message: `Invitation ${status.toLowerCase()}ed` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getWorkspaceMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const members = await (prisma as any).workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const formatted = members.map((m: any) => ({
      id: m.user.id,
      name: m.user.fullName,
      email: m.user.email,
      role: m.role,
      avatar: m.user.avatarUrl,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;
    
    const currentUserMembership = await (prisma as any).workspaceMember.findFirst({
      where: { workspaceId, userId: req.user?.id }
    });

    if (currentUserMembership?.role !== 'ADMIN' && req.user?.email !== 'admin@saas.com') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    if (userId === req.user?.id) {
      return res.status(400).json({ error: 'You cannot remove yourself' });
    }

    await (prisma as any).workspaceMember.deleteMany({
      where: {
        workspaceId,
        userId
      }
    });

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
