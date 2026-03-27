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
  const { id } = req.params;
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
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'ID manquant.' });
  try {
    const [invoice] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, parseInt(id)));
    if (!invoice) return res.status(404).json({ message: 'Facture non trouvée.' });
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)));
    
    const [blResult] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP',
      clientId: invoice.clientId as number,
      date: new Date().toISOString().split('T')[0],
      totalInclTax: invoice.totalInclTax,
      status: 'pending'
    }).returning({ id: deliveryNotes.id });

    if (!blResult) throw new Error('Erreur lors de la création du BL.');

    const noteNumber = `BL-CONV-${blResult.id + 99}`;
    await db.update(deliveryNotes).set({ noteNumber }).where(eq(deliveryNotes.id, blResult.id));

    for (const item of items) {
      await db.insert(deliveryNoteItems).values({
        deliveryNoteId: blResult.id,
        productId: item.productId as number,
        quantity: item.quantity as number,
        unitPrice: item.unitPrice as number,
        taxRate: item.taxRate as number,
        totalLine: item.totalLine as number
      });
    }
    res.json({ message: 'Facture convertie en Bon de Livraison avec succès.', blId: blResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const convertInvoiceToBC = async (req: Request, res: Response) => {
  const { id } = req.params;
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
      orderNumber: 'TEMP',
      supplierId: parseInt(supplierId),
      date: new Date().toISOString().split('T')[0],
      totalInclTax: invoice.totalInclTax,
      status: 'pending'
    }).returning({ id: purchaseOrders.id });

    if (!bcResult) throw new Error('Erreur lors de la création du BC.');

    const orderNumber = `BC-CONV-${bcResult.id + 99}`;
    await db.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, bcResult.id));

    for (const item of items) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: bcResult.id,
        productId: item.productId as number,
        quantity: item.quantity as number,
        unitPrice: item.unitPrice as number,
        taxRate: item.taxRate as number,
        totalLine: item.totalLine as number
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
      const lineExclTax = item.quantity * item.unitPrice;
      const lineTax = lineExclTax * (item.taxRate / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return { ...item, totalLine: lineExclTax + lineTax };
    });
    const totalInclTax = totalExclTax + totalTax;

    const [result] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP',
      clientId: parseInt(clientId),
      date: String(date),
      totalExclTax,
      totalTax,
      totalInclTax,
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
        date: item.date || null
      });
    }
    res.status(201).json({ message: 'Facture créée.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};
