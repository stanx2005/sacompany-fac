import type { Request, Response, NextFunction } from 'express';
import { requireRoles } from './requireRoles.js';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  return requireRoles(['admin'])(req, res, next);
};
