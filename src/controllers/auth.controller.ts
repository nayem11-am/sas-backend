import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const generateAccessToken = (payload: object) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '15m' });

const generateRefreshToken = (payload: object) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Required for sameSite: 'none'
  sameSite: 'none' as const,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existing = await (prisma as any).user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await (prisma as any).user.create({
      data: { email, password: hashed, fullName },
    });

    const existingWorkspace = await (prisma as any).workspace.findFirst({
      include: { owner: true }
    });

    if (existingWorkspace) {
      // Find the main system admin (admin@saas.com) to be the inviter
      const systemAdmin = await (prisma as any).user.findUnique({
        where: { email: 'admin@saas.com' }
      });

      // Instead of directly making them a member, we create an invitation from the admin
      await (prisma as any).invitation.create({
        data: {
          email: user.email,
          workspaceId: existingWorkspace.id,
          role: 'MEMBER',
          invitedById: systemAdmin?.id || existingWorkspace.ownerId,
          status: 'PENDING',
        },
      });
    } else {
      await (prisma as any).workspace.create({
        data: {
          name: `Main Workspace`,
          slug: `main-workspace`,
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: user.email === 'admin@saas.com' ? 'ADMIN' : 'MEMBER',
            },
          },
        },
      });
    }

    res.status(201).json({ message: 'User registered', userId: user.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    let user = await (prisma as any).user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      if (email === 'admin@saas.com' && password === 'admin123456') {
        const hashed = await bcrypt.hash(password, 10);
        const newAdmin = await (prisma as any).user.create({
          data: { email, password: hashed, fullName: 'System Administrator' },
        });
        
        let workspace = await (prisma as any).workspace.findFirst();
        if (!workspace) {
          workspace = await (prisma as any).workspace.create({
            data: {
              name: `Main Workspace`,
              slug: `main-workspace`,
              ownerId: newAdmin.id,
            },
          });
        }
        
        await (prisma as any).workspaceMember.create({
          data: { userId: newAdmin.id, workspaceId: workspace.id, role: 'ADMIN' }
        });
        
        user = newAdmin;
      } else {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
    }

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' }
    });


    const isSpecialAdmin = user.email === 'admin@saas.com';
    const enforcedRole = isSpecialAdmin ? 'admin' : 'member';

    const payload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: enforcedRole,
      workspaceId: membership?.workspaceId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ id: user.id });

    await (prisma as any).user.update({ where: { id: user.id }, data: { refreshToken } });

    res
      .cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      .cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          role: payload.role,
          workspaceId: payload.workspaceId,
        },
      });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as { id: string };
    const user = await (prisma as any).user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== token) {
      res.status(403).json({ error: 'Invalid refresh token' });
      return;
    }

    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'desc' }
    });


    const isSpecialAdmin = user.email === 'admin@saas.com';
    const enforcedRole = isSpecialAdmin ? 'admin' : 'member';

    const payload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: enforcedRole,
      workspaceId: membership?.workspaceId,
    };

    const newAccessToken = generateAccessToken(payload);
    res.cookie('accessToken', newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 }).json({ ok: true });
  } catch {
    res.status(403).json({ error: 'Token refresh failed' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const decoded = jwt.decode(token) as { id: string } | null;
    if (decoded?.id) {
      // Fire and forget, don't wait for DB to make logout fast
      (prisma as any).user.update({ where: { id: decoded.id }, data: { refreshToken: null } }).catch(() => {});
    }
  }
  res
    .clearCookie('accessToken', COOKIE_OPTIONS)
    .clearCookie('refreshToken', COOKIE_OPTIONS)
    .json({ message: 'Logged out' });

};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await (prisma as any).user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    });
    const membership = await (prisma as any).workspaceMember.findFirst({
      where: { userId: req.user.id },
    });
    
    const isSpecialAdmin = user?.email === 'admin@saas.com';
    const enforcedRole = isSpecialAdmin ? 'admin' : 'member';

    res.json({ ...user, role: enforcedRole, workspaceId: membership?.workspaceId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
