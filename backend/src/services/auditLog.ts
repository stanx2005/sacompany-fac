import { db } from '../db/index.js';
import { activityLogs } from '../db/schema.js';

export async function logActivity(
  userId: number | undefined,
  action: string,
  entityType: string,
  entityId: number | null,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(activityLogs).values({
      userId: userId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
