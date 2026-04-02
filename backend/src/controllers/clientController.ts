import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { cashPayments, chequeRegistry, clients, deliveryNotes, openTabs, quotes, salesInvoices } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logActivity } from '../services/auditLog.js';

export const getClients = async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const rows = includeArchived
      ? await db.select().from(clients)
      : await db.select().from(clients).where(sql`COALESCE(${clients.archived}, 0) = 0`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des clients.', error });
  }
};

export const setClientCompleted = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const clientId = parseInt(id || '0', 10);
  const completed = Boolean(req.body?.completed);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db.update(clients).set({ completed: completed ? 1 : 0 }).where(eq(clients.id, clientId));
    await logActivity(uid, completed ? 'mark_complete' : 'unmark_complete', 'client', clientId, {});
    res.json({ message: completed ? 'Client marqué comme terminé.' : 'Marquage retiré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const setClientArchived = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const clientId = parseInt(id || '0', 10);
  const archived = Boolean(req.body?.archived);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db.update(clients).set({ archived: archived ? 1 : 0 }).where(eq(clients.id, clientId));
    await logActivity(uid, archived ? 'archive' : 'unarchive', 'client', clientId, {});
    res.json({ message: archived ? 'Client archivé.' : 'Client restauré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const createClient = async (req: Request, res: Response) => {
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.insert(clients).values({
      name: String(name || ''),
      email: email ? String(email) : null,
      phone: phone ? String(phone) : null,
      address: address ? String(address) : null,
      taxNumber: taxNumber ? String(taxNumber) : null,
      archived: 0,
      completed: 0,
    });
    res.status(201).json({ message: 'Client créé avec succès.' });
  } catch (error) {
    console.error('createClient:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: 'Erreur lors de la création du client.', detail });
  }
};

export const bulkCreateClients = async (req: Request, res: Response) => {
  const { clients: clientsList } = req.body;
  try {
    for (const c of clientsList) {
      await db.insert(clients).values({
        name: String(c.Nom || ''),
        email: String(c.Email || ''),
        phone: String(c.Telephone || ''),
        address: String(c.Adresse || ''),
        taxNumber: String(c.MatriculeFiscale || ''),
        archived: 0,
        completed: 0,
      });
    }
    res.status(201).json({ message: `${clientsList.length} clients importés avec succès.` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'importation.', error });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.update(clients)
      .set({ name, email, phone, address, taxNumber })
      .where(eq(clients.id, parseInt(id || '0')));
    res.json({ message: 'Client mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du client.', error });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    const clientId = parseInt(id || '0');
    if (!clientId) {
      return res.status(400).json({ message: 'ID client invalide.' });
    }

    const [clientRow] = await db.select({ completed: clients.completed }).from(clients).where(eq(clients.id, clientId));
    if (!clientRow) {
      return res.status(404).json({ message: 'Client introuvable.' });
    }
    if (!Number(clientRow.completed || 0)) {
      return res.status(400).json({
        message: 'Marquez le client comme « terminé » avant de le supprimer.',
      });
    }

    const invoices = await db
      .select({ id: salesInvoices.id, totalInclTax: salesInvoices.totalInclTax })
      .from(salesInvoices)
      .where(eq(salesInvoices.clientId, clientId));

    const finalizedInvoiceIds: number[] = [];
    const blockingInvoiceIds: number[] = [];
    for (const inv of invoices) {
      const [cashSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(cashPayments)
        .where(eq(cashPayments.invoiceId, inv.id));
      const [chequeSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(chequeRegistry)
        .where(sql`invoice_id = ${inv.id} AND type = 'incoming'`);

      const total = Number(inv.totalInclTax || 0);
      const paid = Number(cashSum?.total || 0) + Number(chequeSum?.total || 0);
      const remaining = total - paid;
      if (remaining <= 0.0001) {
        finalizedInvoiceIds.push(inv.id);
      } else {
        blockingInvoiceIds.push(inv.id);
      }
    }

    const noteRows = await db
      .select({ id: deliveryNotes.id, status: deliveryNotes.status })
      .from(deliveryNotes)
      .where(eq(deliveryNotes.clientId, clientId));
    const releasableNoteIds = noteRows
      .filter((n) => n.status === 'delivered' || n.status === 'invoiced')
      .map((n) => n.id);
    const blockingNoteIds = noteRows
      .filter((n) => n.status !== 'delivered' && n.status !== 'invoiced')
      .map((n) => n.id);

    const quoteRows = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(eq(quotes.clientId, clientId));
    const releasableQuoteIds = quoteRows
      .filter((q) => q.status === 'accepted' || q.status === 'invoiced')
      .map((q) => q.id);
    const blockingQuoteIds = quoteRows
      .filter((q) => q.status !== 'accepted' && q.status !== 'invoiced')
      .map((q) => q.id);

    const tabRows = await db
      .select({ id: openTabs.id, isClosed: openTabs.isClosed })
      .from(openTabs)
      .where(eq(openTabs.clientId, clientId));
    const releasableTabIds = tabRows.filter((t) => Number(t.isClosed || 0) === 1).map((t) => t.id);
    const blockingTabIds = tabRows.filter((t) => Number(t.isClosed || 0) !== 1).map((t) => t.id);

    const chequeRows = await db
      .select({ id: chequeRegistry.id, status: chequeRegistry.status })
      .from(chequeRegistry)
      .where(eq(chequeRegistry.clientId, clientId));
    const releasableChequeIds = chequeRows.filter((c) => c.status === 'cleared').map((c) => c.id);
    const blockingChequeIds = chequeRows.filter((c) => c.status !== 'cleared').map((c) => c.id);

    const cashRows = await db
      .select({ id: cashPayments.id, invoiceId: cashPayments.invoiceId })
      .from(cashPayments)
      .where(eq(cashPayments.clientId, clientId));
    const releasableCashIds = cashRows
      .filter((c) => c.invoiceId && finalizedInvoiceIds.includes(Number(c.invoiceId)))
      .map((c) => c.id);
    const blockingCashIds = cashRows
      .filter((c) => !c.invoiceId || !finalizedInvoiceIds.includes(Number(c.invoiceId)))
      .map((c) => c.id);

    const blockers = [
      { label: 'facture(s) non payee(s)', count: blockingInvoiceIds.length },
      { label: 'bon(s) de livraison non valide(s)', count: blockingNoteIds.length },
      { label: 'devis non valide(s)', count: blockingQuoteIds.length },
      { label: 'ligne(s) de carnet ouverte(s)', count: blockingTabIds.length },
      { label: 'cheque(s) non encaisse(s)', count: blockingChequeIds.length },
      { label: 'paiement(s) espece non solde(s)', count: blockingCashIds.length },
    ].filter((dep) => dep.count > 0);

    if (blockers.length > 0) {
      const detail = blockers.map((dep) => `${dep.count} ${dep.label}`).join(', ');
      return res.status(409).json({
        message: `Suppression impossible: ce client est encore lie a ${detail}.`,
      });
    }

    // Detach finalized records so FK no-action constraints don't block deleting client.
    for (const invoiceId of finalizedInvoiceIds) {
      await db.update(salesInvoices).set({ clientId: null }).where(eq(salesInvoices.id, invoiceId));
    }
    for (const noteId of releasableNoteIds) {
      await db.update(deliveryNotes).set({ clientId: null }).where(eq(deliveryNotes.id, noteId));
    }
    for (const quoteId of releasableQuoteIds) {
      await db.update(quotes).set({ clientId: null }).where(eq(quotes.id, quoteId));
    }
    for (const tabId of releasableTabIds) {
      await db.update(openTabs).set({ clientId: null }).where(eq(openTabs.id, tabId));
    }
    for (const chequeId of releasableChequeIds) {
      await db.update(chequeRegistry).set({ clientId: null }).where(eq(chequeRegistry.id, chequeId));
    }
    for (const cashId of releasableCashIds) {
      await db.update(cashPayments).set({ clientId: null }).where(eq(cashPayments.id, cashId));
    }

    await db.delete(clients).where(eq(clients.id, clientId));
    const uid = (req as { user?: { id: number } }).user?.id;
    await logActivity(uid, 'delete', 'client', clientId, {});
    res.json({ message: 'Client supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du client.', error });
  }
};
