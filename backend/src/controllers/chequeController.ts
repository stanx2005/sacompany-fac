import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { chequeRegistry, clients, reminders, salesInvoices, suppliers } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

const safeId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0] || '0';
  return id || '0';
};

export const getCheques = async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const base = db
      .select({
        id: chequeRegistry.id,
        chequeNumber: chequeRegistry.chequeNumber,
        bankName: chequeRegistry.bankName,
        amount: chequeRegistry.amount,
        issueDate: chequeRegistry.issueDate,
        dueDate: chequeRegistry.dueDate,
        type: chequeRegistry.type,
        status: chequeRegistry.status,
        isPaid: chequeRegistry.isPaid,
        clientId: chequeRegistry.clientId,
        supplierId: chequeRegistry.supplierId,
        invoiceId: chequeRegistry.invoiceId,
        invoiceNumber: chequeRegistry.invoiceNumber,
        archived: chequeRegistry.archived,
        clientName: clients.name,
        supplierName: suppliers.name,
      })
      .from(chequeRegistry)
      .leftJoin(clients, eq(chequeRegistry.clientId, clients.id))
      .leftJoin(suppliers, eq(chequeRegistry.supplierId, suppliers.id));

    const cheques = includeArchived
      ? await base
      : await base.where(sql`COALESCE(${chequeRegistry.archived}, 0) = 0`);

    res.json(cheques);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des chèques.', error });
  }
};

export const createCheque = async (req: Request, res: Response) => {
  try {
    const { chequeNumber, bankName, amount, issueDate, dueDate, type, clientId, supplierId, invoiceId, invoiceNumber } = req.body;
    const normalizedAmount = Number(amount || 0);
    const normalizedType = type as 'incoming' | 'outgoing';
    const normalizedInvoiceId = invoiceId ? Number(invoiceId) : null;

    if (normalizedAmount <= 0) {
      return res.status(400).json({ message: 'Le montant doit etre superieur a 0.' });
    }

    if (normalizedType === 'incoming' && normalizedInvoiceId) {
      const [invoice] = await db
        .select({
          id: salesInvoices.id,
          clientId: salesInvoices.clientId,
          totalInclTax: salesInvoices.totalInclTax,
        })
        .from(salesInvoices)
        .where(eq(salesInvoices.id, normalizedInvoiceId));

      if (!invoice) {
        return res.status(404).json({ message: 'Facture introuvable.' });
      }

      if (clientId && Number(clientId) !== Number(invoice.clientId || 0)) {
        return res.status(400).json({ message: 'Le client ne correspond pas a la facture liee.' });
      }

      const [linkedChequeSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(chequeRegistry)
        .where(
          and(
            eq(chequeRegistry.invoiceId, normalizedInvoiceId),
            eq(chequeRegistry.type, 'incoming'),
            sql`COALESCE(${chequeRegistry.archived}, 0) = 0`
          )
        );

      const nextChequeTotal = Number(linkedChequeSum?.total || 0) + normalizedAmount;
      if (nextChequeTotal > Number(invoice.totalInclTax || 0) + 0.0001) {
        return res.status(400).json({ message: 'Le total cheque depasse le montant de la facture.' });
      }
    }

    await db.insert(chequeRegistry).values({
      chequeNumber: String(chequeNumber || ''),
      bankName: String(bankName || ''),
      amount: normalizedAmount,
      issueDate: String(issueDate || ''),
      dueDate: String(dueDate || ''),
      type: normalizedType,
      clientId: clientId ? Number(clientId) : null,
      supplierId: supplierId ? Number(supplierId) : null,
      invoiceId: normalizedType === 'incoming' ? normalizedInvoiceId : null,
      invoiceNumber: normalizedType === 'incoming' ? (invoiceNumber ? String(invoiceNumber) : null) : null,
      status: 'pending',
      isPaid: 0
    });
    res.status(201).json({ message: 'Chèque enregistré avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du chèque.', error });
  }
};

export const updateChequeStatus = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const { status, isPaid } = req.body;
  
  try {
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (isPaid !== undefined) updateData.isPaid = Number(isPaid);

    await db.update(chequeRegistry)
      .set(updateData)
      .where(eq(chequeRegistry.id, parseInt(id)));
    res.json({ message: 'Chèque mis à jour.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du chèque.', error });
  }
};

export const setChequeArchived = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  const archived = Boolean(req.body?.archived);
  try {
    await db
      .update(chequeRegistry)
      .set({ archived: archived ? 1 : 0 })
      .where(eq(chequeRegistry.id, id));
    res.json({ message: archived ? 'Chèque archivé.' : 'Chèque restauré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’archivage du chèque.', error });
  }
};

export const deleteCheque = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  try {
    const [row] = await db.select({ id: chequeRegistry.id }).from(chequeRegistry).where(eq(chequeRegistry.id, id));
    if (!row) {
      return res.status(404).json({ message: 'Chèque introuvable.' });
    }
    await db.update(reminders).set({ chequeId: null }).where(eq(reminders.chequeId, id));
    await db.delete(chequeRegistry).where(eq(chequeRegistry.id, id));
    res.json({ message: 'Chèque supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du chèque.', error });
  }
};
