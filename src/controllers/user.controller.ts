import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import cloudinary from '../config/cloudinary';
import fs from 'fs';
import bcrypt from 'bcryptjs';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { fullName } = req.body;

    const user = await (prisma as any).user.update({
      where: { id: userId },
      data: { fullName },
    });

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const user = await (prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (prisma as any).user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
       console.warn('Cloudinary not configured. Simulating upload.');
       const mockUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent('User')}&background=random`;
       
       await (prisma as any).user.update({
         where: { id: userId },
         data: { avatarUrl: mockUrl },
       });
       
       return res.json({ 
         message: 'Profile picture updated (Simulated)', 
         avatar: mockUrl 
       });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'sui_avatars',
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    });

    // Remove file from local storage
    fs.unlinkSync(req.file.path);

    // Update user in DB
    const updatedUser = await (prisma as any).user.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
    });

    res.json({ 
      message: 'Profile picture updated successfully', 
      avatar: result.secure_url 
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Internal server error' });
  }
};
