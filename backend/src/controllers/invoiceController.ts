import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { salesInvoices, invoiceItems, clients, products, deliveryNotes, deliveryNoteItems, purchaseOrders, purchaseOrderItems, chequeRegistry, cashPayments } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

const safeId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0] || '0';
  return id || '0';
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await db.select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      date: salesInvoices.date,
      totalInclTax: salesInvoices.totalInclTax,
      status: salesInvoices.status,
      clientId: salesInvoices.clientId,
      clientName: clients.name,
      taxNumber: clients.taxNumber,
      address: clients.address,
      phone: clients.phone,
    })
    .from(salesInvoices)
    .leftJoin(clients, eq(salesInvoices.clientId, clients.id));

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
              eq(chequeRegistry.type, 'incoming')
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

    const noteNumber = `BL-CONV-${blResult.id + 99}`;
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

    const orderNumber = `BC-CONV-${bcResult.id + 99}`;
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
      status: 'pending'
    } as any).returning({ id: salesInvoices.id });

    if (!result) throw new Error('Erreur facture.');

    const invoiceNumber = `FACT-${result.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, result.id));

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
