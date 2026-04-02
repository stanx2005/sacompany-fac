import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { chequeRegistry, clients, reminders } from '../db/schema.js';
import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

const chequeClient = alias(clients, 'reminder_cheque_client');

function uid(req: Request): number {
  return Number((req as { user?: { id: number } }).user?.id || 0);
}

export const getReminders = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ message: 'Non authentifié.' });
  try {
    const rows = await db
      .select({
        id: reminders.id,
        userId: reminders.userId,
        clientId: reminders.clientId,
        chequeId: reminders.chequeId,
        title: reminders.title,
        note: reminders.note,
        dueDate: reminders.dueDate,
        completed: reminders.completed,
        createdAt: reminders.createdAt,
        clientName: clients.name,
        chequeNumber: chequeRegistry.chequeNumber,
        chequeBankName: chequeRegistry.bankName,
        chequeAmount: chequeRegistry.amount,
        chequeIssueDate: chequeRegistry.issueDate,
        chequeDueDate: chequeRegistry.dueDate,
        chequeType: chequeRegistry.type,
        chequeStatus: chequeRegistry.status,
        chequeInvoiceNumber: chequeRegistry.invoiceNumber,
        chequeClientName: chequeClient.name,
      })
      .from(reminders)
      .leftJoin(clients, eq(reminders.clientId, clients.id))
      .leftJoin(chequeRegistry, eq(reminders.chequeId, chequeRegistry.id))
      .leftJoin(chequeClient, eq(chequeRegistry.clientId, chequeClient.id))
      .where(eq(reminders.userId, userId))
      .orderBy(desc(reminders.dueDate), desc(reminders.id));
    res.json(rows);
  } catch (error) {
    console.error('getReminders:', error);
    res.status(500).json({ message: 'Erreur chargement rappels.', error });
  }
};

export const createReminder = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ message: 'Non authentifié.' });
  const title = String(req.body?.title || '').trim();
  const note = req.body?.note != null ? String(req.body.note) : null;
  const dueDate = String(req.body?.dueDate || '').trim();
  const rawClientId = req.body?.clientId;
  let clientId: number | null = null;
  if (rawClientId != null && rawClientId !== '') {
    const cid = parseInt(String(rawClientId), 10);
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ message: 'Client invalide.' });
    }
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, cid));
    if (!c) return res.status(400).json({ message: 'Client introuvable.' });
    clientId = cid;
  }
  const rawChequeId = req.body?.chequeId;
  let chequeId: number | null = null;
  if (rawChequeId != null && rawChequeId !== '') {
    const qid = parseInt(String(rawChequeId), 10);
    if (!Number.isFinite(qid) || qid < 1) {
      return res.status(400).json({ message: 'Chèque invalide.' });
    }
    const [q] = await db.select({ id: chequeRegistry.id }).from(chequeRegistry).where(eq(chequeRegistry.id, qid));
    if (!q) return res.status(400).json({ message: 'Chèque introuvable.' });
    chequeId = qid;
  }
  if (!title) return res.status(400).json({ message: 'Titre requis.' });
  if (!dueDate) return res.status(400).json({ message: 'Date d’échéance requise.' });
  try {
    const [row] = await db
      .insert(reminders)
      .values({
        userId,
        clientId,
        chequeId,
        title,
        note: note || null,
        dueDate,
        completed: 0,
      } as any)
      .returning();
    res.status(201).json(row);
  } catch (error) {
    console.error('createReminder:', error);
    res.status(500).json({ message: 'Erreur création rappel.', error });
  }
};

export const updateReminder = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ message: 'Non authentifié.' });
  const id = parseInt(String(req.params.id || '0'), 10);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  try {
    const [existing] = await db.select().from(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
    if (!existing) return res.status(404).json({ message: 'Rappel introuvable.' });

    const title = req.body?.title != null ? String(req.body.title).trim() : existing.title;
    const note = req.body?.note !== undefined ? (req.body.note == null ? null : String(req.body.note)) : existing.note;
    const dueDate = req.body?.dueDate != null ? String(req.body.dueDate).trim() : existing.dueDate;
    const completed =
      req.body?.completed !== undefined ? (req.body.completed ? 1 : 0) : Number(existing.completed || 0);

    let clientId: number | null | undefined = undefined;
    if (req.body?.clientId !== undefined) {
      if (req.body.clientId == null || req.body.clientId === '') {
        clientId = null;
      } else {
        const cid = parseInt(String(req.body.clientId), 10);
        if (!Number.isFinite(cid) || cid < 1) {
          return res.status(400).json({ message: 'Client invalide.' });
        }
        const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, cid));
        if (!c) return res.status(400).json({ message: 'Client introuvable.' });
        clientId = cid;
      }
    }

    let chequeId: number | null | undefined = undefined;
    if (req.body?.chequeId !== undefined) {
      if (req.body.chequeId == null || req.body.chequeId === '') {
        chequeId = null;
      } else {
        const qid = parseInt(String(req.body.chequeId), 10);
        if (!Number.isFinite(qid) || qid < 1) {
          return res.status(400).json({ message: 'Chèque invalide.' });
        }
        const [q] = await db.select({ id: chequeRegistry.id }).from(chequeRegistry).where(eq(chequeRegistry.id, qid));
        if (!q) return res.status(400).json({ message: 'Chèque introuvable.' });
        chequeId = qid;
      }
    }

    if (!title) return res.status(400).json({ message: 'Titre requis.' });
    if (!dueDate) return res.status(400).json({ message: 'Date requise.' });

    const patch: Record<string, unknown> = { title, note, dueDate, completed };
    if (clientId !== undefined) patch.clientId = clientId;
    if (chequeId !== undefined) patch.chequeId = chequeId;

    await db
      .update(reminders)
      .set(patch as any)
      .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));

    const [row] = await db
      .select({
        id: reminders.id,
        userId: reminders.userId,
        clientId: reminders.clientId,
        chequeId: reminders.chequeId,
        title: reminders.title,
        note: reminders.note,
        dueDate: reminders.dueDate,
        completed: reminders.completed,
        createdAt: reminders.createdAt,
        clientName: clients.name,
        chequeNumber: chequeRegistry.chequeNumber,
        chequeBankName: chequeRegistry.bankName,
        chequeAmount: chequeRegistry.amount,
        chequeIssueDate: chequeRegistry.issueDate,
        chequeDueDate: chequeRegistry.dueDate,
        chequeType: chequeRegistry.type,
        chequeStatus: chequeRegistry.status,
        chequeInvoiceNumber: chequeRegistry.invoiceNumber,
        chequeClientName: chequeClient.name,
      })
      .from(reminders)
      .leftJoin(clients, eq(reminders.clientId, clients.id))
      .leftJoin(chequeRegistry, eq(reminders.chequeId, chequeRegistry.id))
      .leftJoin(chequeClient, eq(chequeRegistry.clientId, chequeClient.id))
      .where(eq(reminders.id, id));
    res.json(row);
  } catch (error) {
    console.error('updateReminder:', error);
    res.status(500).json({ message: 'Erreur mise à jour.', error });
  }
};

export const deleteReminder = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ message: 'Non authentifié.' });
  const id = parseInt(String(req.params.id || '0'), 10);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  try {
    const [existing] = await db.select().from(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
    if (!existing) return res.status(404).json({ message: 'Rappel introuvable.' });
    await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
    res.json({ message: 'Rappel supprimé.' });
  } catch (error) {
    console.error('deleteReminder:', error);
    res.status(500).json({ message: 'Erreur suppression.', error });
  }
};
