import type { NextFunction, Request, Response } from 'express';

type AppRole = 'admin' | 'staff' | 'accountant';

export function requireRoles(allowed: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as { user?: { role?: AppRole } }).user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: 'Accès refusé pour ce rôle.' });
    }
    next();
  };
}
