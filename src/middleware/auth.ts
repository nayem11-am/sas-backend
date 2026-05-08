import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { Server } from 'socket.io';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    workspaceId?: string;
    fullName?: string;
  };
  io?: Server;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
