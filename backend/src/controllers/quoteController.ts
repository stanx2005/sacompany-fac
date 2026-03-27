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
  const quoteId = Array.isArray(id) ? id[0] : id;
  if (!quoteId) return res.status(400).json({ message: 'ID manquant.' });
  
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
    .where(eq(quoteItems.quoteId, parseInt(quoteId)));
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
      const lineExclTax = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const lineTax = lineExclTax * (Number(item.taxRate || 20) / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return { ...item, totalLine: lineExclTax + lineTax };
    });
    const totalInclTax = totalExclTax + totalTax;

    const [result] = await db.insert(quotes).values({
      quoteNumber: 'TEMP',
      clientId: parseInt(String(clientId)),
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
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        totalLine: Number(item.totalLine)
      });
    }
    res.status(201).json({ message: 'Devis créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  const { id } = req.params;
  const quoteId = Array.isArray(id) ? id[0] : id;
  const { clientId, date, items } = req.body;
  
  if (!quoteId) return res.status(400).json({ message: 'ID manquant.' });

  try {
    let totalExclTax = 0;
    let totalTax = 0;
    const processedItems = items.map((item: any) => {
      const lineExclTax = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const lineTax = lineExclTax * (Number(item.taxRate || 20) / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return { ...item, totalLine: lineExclTax + lineTax };
    });
    const totalInclTax = totalExclTax + totalTax;

    await db.update(quotes).set({
      clientId: parseInt(String(clientId)),
      date: String(date),
      totalExclTax,
      totalTax,
      totalInclTax
    }).where(eq(quotes.id, parseInt(quoteId)));

    await db.delete(quoteItems).where(eq(quoteItems.quoteId, parseInt(quoteId)));
    
    for (const item of processedItems) {
      await db.insert(quoteItems).values({
        quoteId: parseInt(quoteId),
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        totalLine: Number(item.totalLine)
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
  const quoteId = Array.isArray(id) ? id[0] : id;
  if (!quoteId) return res.status(400).json({ message: 'ID manquant.' });

  try {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, parseInt(quoteId)));
    if (!quote) return res.status(404).json({ message: 'Devis non trouvé.' });

    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, parseInt(quoteId)));
    
    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP',
      clientId: Number(quote.clientId),
      date: new Date().toISOString().split('T')[0],
      totalExclTax: Number(quote.totalExclTax),
      totalTax: Number(quote.totalTax),
      totalInclTax: Number(quote.totalInclTax),
      status: 'pending'
    }).returning({ id: salesInvoices.id });

    if (!invoiceResult) throw new Error('Erreur lors de la création de la facture.');

    const invoiceNumber = `FACT-DEV-${invoiceResult.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceResult.id));

    for (const item of items) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        totalLine: Number(item.totalLine),
        date: new Date().toISOString().split('T')[0]
      });
    }
    
    await db.update(quotes).set({ status: 'invoiced' }).where(eq(quotes.id, parseInt(quoteId)));
    
    res.json({ message: 'Devis converti en Facture avec succès.', invoiceId: invoiceResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};
