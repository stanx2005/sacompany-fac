import type { Request, Response } from 'express';
import { db } from '../db';
import { quotes, quoteItems, clients, products, salesInvoices, invoiceItems } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getQuotes = async (req: Request, res: Response) => {
  try {
    const allQuotes = await db.select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      date: quotes.date,
      totalInclTax: quotes.totalInclTax,
      status: quotes.status,
      clientId: quotes.clientId,
      clientName: clients.name,
      taxNumber: clients.taxNumber,
      address: clients.address,
      phone: clients.phone,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id));
    
    res.json(allQuotes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des devis.', error });
  }
};

export const getQuoteItems = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const items = await db.select({
      id: quoteItems.id,
      productId: quoteItems.productId,
      productName: products.name,
      quantity: quoteItems.quantity,
      unitPrice: quoteItems.unitPrice,
      taxRate: quoteItems.taxRate,
      totalLine: quoteItems.totalLine,
    })
    .from(quoteItems)
    .leftJoin(products, eq(quoteItems.productId, products.id))
    .where(eq(quoteItems.quoteId, parseInt(id || '0')));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur items.', error });
  }
};

export const createQuote = async (req: Request, res: Response) => {
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

    const [result] = await db.insert(quotes).values({
      quoteNumber: 'TEMP',
      clientId: parseInt(clientId),
      date: String(date),
      totalExclTax,
      totalTax,
      totalInclTax,
      status: 'pending'
    }).returning({ id: quotes.id });

    if (!result) throw new Error('Erreur lors de la création du devis.');

    const quoteNumber = `DEV-${result.id + 99}`;
    await db.update(quotes).set({ quoteNumber }).where(eq(quotes.id, result.id));

    for (const item of processedItems) {
      await db.insert(quoteItems).values({
        quoteId: result.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      });
    }
    res.status(201).json({ message: 'Devis créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  const { id } = req.params;
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

    // 1. Update main quote record
    await db.update(quotes).set({
      clientId: parseInt(clientId),
      date: String(date),
      totalExclTax,
      totalTax,
      totalInclTax
    }).where(eq(quotes.id, parseInt(id || '0')));

    // 2. Delete existing items and re-insert (simpler than updating)
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, parseInt(id || '0')));
    
    for (const item of processedItems) {
      await db.insert(quoteItems).values({
        quoteId: parseInt(id || '0'),
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      });
    }

    res.json({ message: 'Devis mis à jour avec succès.' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour.', error });
  }
};

export const convertQuoteToInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, parseInt(id || '0')));
    if (!quote) return res.status(404).json({ message: 'Devis non trouvé.' });

    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, parseInt(id || '0')));
    
    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP',
      clientId: quote.clientId,
      date: new Date().toISOString().split('T')[0],
      totalExclTax: quote.totalExclTax,
      totalTax: quote.totalTax,
      totalInclTax: quote.totalInclTax,
      status: 'pending'
    }).returning({ id: salesInvoices.id });

    if (!invoiceResult) throw new Error('Erreur lors de la création de la facture.');

    const invoiceNumber = `FACT-DEV-${invoiceResult.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceResult.id));

    for (const item of items) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: item.productId as number,
        quantity: item.quantity as number,
        unitPrice: item.unitPrice as number,
        taxRate: item.taxRate as number,
        totalLine: item.totalLine as number
      });
    }
    
    await db.update(quotes).set({ status: 'invoiced' }).where(eq(quotes.id, parseInt(id || '0')));
    
    res.json({ message: 'Devis converti en Facture avec succès.', invoiceId: invoiceResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};
