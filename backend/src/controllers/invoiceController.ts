import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { salesInvoices, invoiceItems, clients, products, deliveryNotes, deliveryNoteItems, purchaseOrders, purchaseOrderItems, chequeRegistry, cashPayments } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { docNumber, getMainConfig } from '../services/appConfig.js';
import { logActivity } from '../services/auditLog.js';

const safeId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0] || '0';
  return id || '0';
};

const invoiceListSelect = {
  id: salesInvoices.id,
  invoiceNumber: salesInvoices.invoiceNumber,
  date: salesInvoices.date,
  totalInclTax: salesInvoices.totalInclTax,
  status: salesInvoices.status,
  archived: salesInvoices.archived,
  completed: salesInvoices.completed,
  clientId: salesInvoices.clientId,
  clientName: clients.name,
  taxNumber: clients.taxNumber,
  address: clients.address,
  phone: clients.phone,
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const invoices = includeArchived
      ? await db
          .select(invoiceListSelect)
          .from(salesInvoices)
          .leftJoin(clients, eq(salesInvoices.clientId, clients.id))
      : await db
          .select(invoiceListSelect)
          .from(salesInvoices)
          .leftJoin(clients, eq(salesInvoices.clientId, clients.id))
          .where(sql`COALESCE(${salesInvoices.archived}, 0) = 0`);

    const withPayments = await Promise.all(
      invoices.map(async (invoice) => {
        const [cashSum] = await db
          .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
          .from(cashPayments)
          .where(eq(cashPayments.invoiceId, invoice.id));

        const [chequeSum] = await db
          .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
          .from(chequeRegistry)
          .where(
            and(
              eq(chequeRegistry.invoiceId, invoice.id),
              eq(chequeRegistry.type, 'incoming'),
              sql`COALESCE(${chequeRegistry.archived}, 0) = 0`
            )
          );

        const paidCash = Number(cashSum?.total || 0);
        const paidCheque = Number(chequeSum?.total || 0);
        const totalPaid = paidCash + paidCheque;
        const total = Number(invoice.totalInclTax || 0);
        const remaining = Math.max(total - totalPaid, 0);
        const paymentStatus = totalPaid <= 0 ? 'unpaid' : remaining <= 0.0001 ? 'paid' : 'partial';

        return {
          ...invoice,
          paidCash,
          paidCheque,
          totalPaid,
          remaining,
          paymentStatus,
        };
      })
    );

    res.json(withPayments);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des factures.', error });
  }
};

export const getInvoiceItems = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  try {
    const items = await db.select({
      id: invoiceItems.id,
      productId: invoiceItems.productId,
      productName: products.name,
      quantity: invoiceItems.quantity,
      unitPrice: invoiceItems.unitPrice,
      taxRate: invoiceItems.taxRate,
      totalLine: invoiceItems.totalLine,
      date: invoiceItems.date,
    })
    .from(invoiceItems)
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(eq(invoiceItems.invoiceId, parseInt(id)));

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur items.', error });
  }
};

export const getInvoicePaymentTimeline = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const invoiceId = parseInt(id || '0', 10);
  if (!invoiceId) {
    return res.status(400).json({ message: 'ID invalide.' });
  }
  try {
    const cashRows = await db
      .select({
        id: cashPayments.id,
        paymentDate: cashPayments.paymentDate,
        amount: cashPayments.amount,
        paymentNumber: cashPayments.paymentNumber,
        note: cashPayments.note,
      })
      .from(cashPayments)
      .where(eq(cashPayments.invoiceId, invoiceId));

    const chequeRows = await db
      .select({
        id: chequeRegistry.id,
        issueDate: chequeRegistry.issueDate,
        dueDate: chequeRegistry.dueDate,
        amount: chequeRegistry.amount,
        chequeNumber: chequeRegistry.chequeNumber,
        bankName: chequeRegistry.bankName,
      })
      .from(chequeRegistry)
      .where(
        and(
          eq(chequeRegistry.invoiceId, invoiceId),
          eq(chequeRegistry.type, 'incoming'),
          sql`COALESCE(${chequeRegistry.archived}, 0) = 0`
        )
      );

    const events = [
      ...cashRows.map((c) => ({
        kind: 'cash' as const,
        date: c.paymentDate,
        amount: Number(c.amount || 0),
        reference: c.paymentNumber,
        detail: c.note || null,
      })),
      ...chequeRows.map((c) => ({
        kind: 'cheque' as const,
        date: c.issueDate,
        amount: Number(c.amount || 0),
        reference: c.chequeNumber,
        detail: c.bankName || null,
        dueDate: c.dueDate,
      })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    res.json({ invoiceId, events });
  } catch (error) {
    res.status(500).json({ message: 'Erreur timeline.', error });
  }
};

export const setInvoiceArchived = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const invoiceId = parseInt(id || '0', 10);
  const archived = Boolean(req.body?.archived);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db
      .update(salesInvoices)
      .set({ archived: archived ? 1 : 0 })
      .where(eq(salesInvoices.id, invoiceId));
    await logActivity(uid, archived ? 'archive' : 'unarchive', 'invoice', invoiceId, {});
    res.json({ message: archived ? 'Facture archivée.' : 'Facture restaurée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const setInvoiceCompleted = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const invoiceId = parseInt(id || '0', 10);
  const completed = Boolean(req.body?.completed);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db
      .update(salesInvoices)
      .set({ completed: completed ? 1 : 0 })
      .where(eq(salesInvoices.id, invoiceId));
    await logActivity(uid, completed ? 'mark_complete' : 'unmark_complete', 'invoice', invoiceId, {});
    res.json({ message: completed ? 'Facture marquée comme terminée.' : 'Marquage terminé retiré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const invoiceId = parseInt(id || '0', 10);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    const [inv] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, invoiceId));
    if (!inv) {
      return res.status(404).json({ message: 'Facture non trouvée.' });
    }
    if (!Number(inv.completed || 0)) {
      return res.status(400).json({
        message: 'Marquez la facture comme « terminée » avant de la supprimer.',
      });
    }
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await db.update(cashPayments).set({ invoiceId: null }).where(eq(cashPayments.invoiceId, invoiceId));
    await db
      .update(chequeRegistry)
      .set({ invoiceId: null, invoiceNumber: null })
      .where(eq(chequeRegistry.invoiceId, invoiceId));
    await db.delete(salesInvoices).where(eq(salesInvoices.id, invoiceId));
    await logActivity(uid, 'delete', 'invoice', invoiceId, { invoiceNumber: inv.invoiceNumber });
    res.json({ message: 'Facture supprimée.' });
  } catch (error) {
    console.error('deleteInvoice:', error);
    res.status(500).json({ message: 'Erreur suppression facture.', error });
  }
};

export const convertInvoiceToBL = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  try {
    const [invoice] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, parseInt(id)));
    if (!invoice) return res.status(404).json({ message: 'Facture non trouvée.' });
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)));
    
    const [blResult] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP-BL-' + Date.now(),
      clientId: Number(invoice.clientId || 0),
      date: new Date().toISOString().split('T')[0] || '',
      totalInclTax: Number(invoice.totalInclTax || 0),
      status: 'pending'
    } as any).returning({ id: deliveryNotes.id });

    if (!blResult) throw new Error('Erreur BL.');

    const cfg = await getMainConfig();
    const noteNumber = docNumber(cfg.numbering.blConv, blResult.id);
    await db.update(deliveryNotes).set({ noteNumber }).where(eq(deliveryNotes.id, blResult.id));

    for (const item of items) {
      await db.insert(deliveryNoteItems).values({
        deliveryNoteId: blResult.id,
        productId: Number(item.productId || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
        totalLine: Number(item.totalLine || 0)
      } as any);
    }
    res.json({ message: 'Facture convertie en Bon de Livraison avec succès.', blId: blResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const convertInvoiceToBC = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const { supplierId } = req.body;

  if (!supplierId) {
    return res.status(400).json({ message: 'Un fournisseur est requis.' });
  }

  try {
    const [invoice] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, parseInt(id)));
    if (!invoice) return res.status(404).json({ message: 'Facture non trouvée.' });
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)));
    
    const [bcResult] = await db.insert(purchaseOrders).values({
      orderNumber: 'TEMP-BC-' + Date.now(),
      supplierId: Number(supplierId || 0),
      date: new Date().toISOString().split('T')[0] || '',
      totalInclTax: Number(invoice.totalInclTax || 0),
      status: 'pending'
    } as any).returning({ id: purchaseOrders.id });

    if (!bcResult) throw new Error('Erreur BC.');

    const cfg = await getMainConfig();
    const orderNumber = docNumber(cfg.numbering.bcConv, bcResult.id);
    await db.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, bcResult.id));

    for (const item of items) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: bcResult.id,
        productId: Number(item.productId || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
        totalLine: Number(item.totalLine || 0)
      } as any);
    }
    res.json({ message: 'Facture convertie en Bon de Commande avec succès.', bcId: bcResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  const { clientId, date, items } = req.body;
  try {
    let totalExclTax = 0;
    let totalTax = 0;
    const processedItems = items.map((item: any) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      const tax = Number(item.taxRate || 20);
      const lineExclTax = qty * price;
      const lineTax = lineExclTax * (tax / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return { 
        productId: Number(item.productId),
        quantity: qty,
        unitPrice: price,
        taxRate: tax,
        totalLine: lineExclTax + lineTax,
        date: item.date ? String(item.date) : null
      };
    });
    const totalInclTax = totalExclTax + totalTax;

    const [result] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP-INV-' + Date.now(),
      clientId: Number(clientId || 0),
      date: String(date || ''),
      totalExclTax: Number(totalExclTax),
      totalTax: Number(totalTax),
      totalInclTax: Number(totalInclTax),
      status: 'pending',
      completed: 0,
    } as any).returning({ id: salesInvoices.id });

    if (!result) throw new Error('Erreur facture.');

    const cfg = await getMainConfig();
    const invoiceNumber = docNumber(cfg.numbering.invoice, result.id);
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, result.id));

    const uid = (req as { user?: { id: number } }).user?.id;
    await logActivity(uid, 'create', 'invoice', result.id, { invoiceNumber });

    for (const item of processedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: result.id,
        productId: Number(item.productId || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
        totalLine: Number(item.totalLine || 0),
        date: item.date
      } as any);
    }
    res.status(201).json({ message: 'Facture créée.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};
