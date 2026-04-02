import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { activityLogs, users } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const rows = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        userName: users.name,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.id))
      .limit(limit);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erreur journal.', error });
  }
};
