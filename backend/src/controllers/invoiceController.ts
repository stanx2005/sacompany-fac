import type { Request, Response } from 'express';
import { db } from '../db';
import { salesInvoices, invoiceItems, clients, products, deliveryNotes, deliveryNoteItems, purchaseOrders, purchaseOrderItems } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des factures.', error });
  }
};

export const getInvoiceItems = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return res.status(400).json({ message: 'ID manquant.' });
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
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return res.status(400).json({ message: 'ID manquant.' });
  try {
    const [invoice] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, parseInt(id)));
    if (!invoice) return res.status(404).json({ message: 'Facture non trouvée.' });
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)));
    
    const [blResult] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP-' + Date.now(),
      clientId: Number(invoice.clientId),
      date: new Date().toISOString().split('T')[0],
      totalInclTax: Number(invoice.totalInclTax),
      status: 'pending'
    }).returning({ id: deliveryNotes.id });

    if (!blResult) throw new Error('Erreur lors de la création du BL.');

    const noteNumber = `BL-CONV-${blResult.id + 99}`;
    await db.update(deliveryNotes).set({ noteNumber }).where(eq(deliveryNotes.id, blResult.id));

    for (const item of items) {
      await db.insert(deliveryNoteItems).values({
        deliveryNoteId: blResult.id,
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        totalLine: Number(item.totalLine)
      });
    }
    res.json({ message: 'Facture convertie en Bon de Livraison avec succès.', blId: blResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const convertInvoiceToBC = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { supplierId } = req.body;

  if (!id) return res.status(400).json({ message: 'ID facture manquant.' });
  if (!supplierId) {
    return res.status(400).json({ message: 'Un fournisseur est requis pour cette conversion.' });
  }

  try {
    const [invoice] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, parseInt(id)));
    if (!invoice) return res.status(404).json({ message: 'Facture non trouvée.' });
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)));
    
    const [bcResult] = await db.insert(purchaseOrders).values({
      orderNumber: 'TEMP-' + Date.now(),
      supplierId: parseInt(String(supplierId)),
      date: new Date().toISOString().split('T')[0],
      totalInclTax: Number(invoice.totalInclTax),
      status: 'pending'
    }).returning({ id: purchaseOrders.id });

    if (!bcResult) throw new Error('Erreur lors de la création du BC.');

    const orderNumber = `BC-CONV-${bcResult.id + 99}`;
    await db.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, bcResult.id));

    for (const item of items) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: bcResult.id,
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        totalLine: Number(item.totalLine)
      });
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
      invoiceNumber: 'TEMP-' + Date.now(),
      clientId: parseInt(String(clientId)),
      date: String(date),
      totalExclTax: Number(totalExclTax),
      totalTax: Number(totalTax),
      totalInclTax: Number(totalInclTax),
      status: 'pending'
    }).returning({ id: salesInvoices.id });

    if (!result) throw new Error('Erreur lors de la création de la facture.');

    const invoiceNumber = `FACT-${result.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, result.id));

    for (const item of processedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: result.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine,
        date: item.date
      });
    }
    res.status(201).json({ message: 'Facture créée.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};
