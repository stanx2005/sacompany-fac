import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { cashPayments, chequeRegistry, clients, reminders, salesInvoices } from '../db/schema.js';
import { and, asc, eq, sql } from 'drizzle-orm';

/** Rappels système (chèques, factures) + rappels personnels à traiter bientôt. */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const upcomingCheques = await db
      .select({
        id: chequeRegistry.id,
        chequeNumber: chequeRegistry.chequeNumber,
        dueDate: chequeRegistry.dueDate,
        amount: chequeRegistry.amount,
        clientName: clients.name,
      })
      .from(chequeRegistry)
      .leftJoin(clients, eq(chequeRegistry.clientId, clients.id))
      .where(
        and(
          eq(chequeRegistry.type, 'incoming'),
          eq(chequeRegistry.status, 'pending'),
          sql`COALESCE(${chequeRegistry.archived}, 0) = 0`,
          sql`${chequeRegistry.dueDate} >= ${today}`,
          sql`${chequeRegistry.dueDate} <= ${in7}`
        )
      )
      .limit(50);

    const invoices = await db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        date: salesInvoices.date,
        totalInclTax: salesInvoices.totalInclTax,
        clientId: salesInvoices.clientId,
        clientName: clients.name,
      })
      .from(salesInvoices)
      .leftJoin(clients, eq(salesInvoices.clientId, clients.id))
      .where(sql`COALESCE(${salesInvoices.archived}, 0) = 0`);

    const overdueInvoices: Array<{
      id: number;
      invoiceNumber: string;
      date: string;
      remaining: number;
      clientName: string | null;
    }> = [];

    for (const inv of invoices) {
      const [cashSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(cashPayments)
        .where(eq(cashPayments.invoiceId, inv.id));
      const [chequeSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(chequeRegistry)
        .where(sql`invoice_id = ${inv.id} AND type = 'incoming'`);

      const paid = Number(cashSum?.total || 0) + Number(chequeSum?.total || 0);
      const total = Number(inv.totalInclTax || 0);
      const remaining = Math.max(total - paid, 0);
      if (remaining > 0.01) {
        const d = inv.date ? new Date(inv.date) : null;
        if (d && !Number.isNaN(d.getTime())) {
          const daysOld = (Date.now() - d.getTime()) / 86400000;
          if (daysOld > 30) {
            overdueInvoices.push({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              date: inv.date,
              remaining,
              clientName: inv.clientName,
            });
          }
        }
      }
    }

    const userId = Number((req as { user?: { id: number } }).user?.id || 0);
    let userRemindersDue: Array<{
      id: number;
      title: string;
      dueDate: string;
      note: string | null;
    }> = [];
    if (userId) {
      userRemindersDue = await db
        .select({
          id: reminders.id,
          title: reminders.title,
          dueDate: reminders.dueDate,
          note: reminders.note,
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.userId, userId),
            eq(reminders.completed, 0),
            sql`${reminders.dueDate} <= ${in7}`
          )
        )
        .orderBy(asc(reminders.dueDate))
        .limit(50);
    }

    res.json({
      upcomingCheques,
      overdueInvoices: overdueInvoices.slice(0, 50),
      userRemindersDue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur notifications.', error });
  }
};
