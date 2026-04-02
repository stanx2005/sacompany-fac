import type { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role;
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux administrateurs.' });
  }
  next();
};
