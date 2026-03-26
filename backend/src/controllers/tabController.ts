import type { Request, Response } from 'express';
import { db } from '../db';
import { openTabs, clients, products, salesInvoices, invoiceItems } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const getOpenTabs = async (req: Request, res: Response) => {
  try {
    const tabs = await db.select({
      id: openTabs.id,
      clientId: openTabs.clientId,
      clientName: clients.name,
      productId: openTabs.productId,
      productName: products.name,
      productPrice: products.price,
      productTaxRate: products.taxRate,
      quantity: openTabs.quantity,
      date: openTabs.date,
      isClosed: openTabs.isClosed,
    })
    .from(openTabs)
    .leftJoin(clients, eq(openTabs.clientId, clients.id))
    .leftJoin(products, eq(openTabs.productId, products.id))
    .where(eq(openTabs.isClosed, 0));
    
    res.json(tabs);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du carnet.', error });
  }
};

export const addToTab = async (req: Request, res: Response) => {
  const { clientId, productId, quantity, date } = req.body;
  try {
    await db.insert(openTabs).values({ clientId, productId, quantity, date, isClosed: 0 });
    res.status(201).json({ message: 'Ajouté au carnet avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout au carnet.', error });
  }
};

export const deleteTabItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(openTabs).where(eq(openTabs.id, parseInt(id || '0')));
    res.json({ message: 'Article supprimé du carnet.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error });
  }
};

export const closeTabsForClient = async (req: Request, res: Response) => {
  const { clientId } = req.params;
  if (!clientId) return res.status(400).json({ message: 'ID client manquant.' });

  try {
    // 1. Fetch all open tab items for this client
    const items = await db.select({
      productId: openTabs.productId,
      quantity: openTabs.quantity,
      date: openTabs.date,
      unitPrice: products.price,
      taxRate: products.taxRate,
    })
    .from(openTabs)
    .leftJoin(products, eq(openTabs.productId, products.id))
    .where(and(eq(openTabs.clientId, parseInt(clientId)), eq(openTabs.isClosed, 0)));

    if (items.length === 0) {
      return res.status(400).json({ message: 'Aucun article ouvert pour ce client.' });
    }

    // 2. Calculate totals
    let totalExclTax = 0;
    let totalTax = 0;
    const processedItems = items.map(item => {
      const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice || '0'));
      const taxRate = typeof item.taxRate === 'number' ? item.taxRate : parseFloat(String(item.taxRate || '20'));
      const lineExclTax = (item.quantity || 0) * price;
      const lineTax = lineExclTax * (taxRate / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return {
        ...item,
        unitPrice: price,
        taxRate: taxRate,
        totalLine: lineExclTax + lineTax,
        date: item.date // Preserve the date from the tab
      };
    });
    const totalInclTax = totalExclTax + totalTax;

    // 3. Create the Invoice
    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP',
      clientId: parseInt(clientId),
      date: new Date().toISOString().split('T')[0],
      totalExclTax,
      totalTax,
      totalInclTax,
      status: 'pending'
    }).returning({ id: salesInvoices.id });

    if (!invoiceResult) throw new Error('Erreur lors de la création de la facture.');

    const invoiceNumber = `FACT-TAB-${invoiceResult.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceResult.id));

    // 4. Insert Invoice Items
    for (const item of processedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: item.productId as number,
        quantity: item.quantity as number,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine,
        date: item.date // Store the date in invoice_items
      });
    }

    // 5. Mark tabs as closed
    await db.update(openTabs)
      .set({ isClosed: 1 })
      .where(and(eq(openTabs.clientId, parseInt(clientId)), eq(openTabs.isClosed, 0)));

    res.json({ message: 'Carnet clôturé et facture générée avec succès.', invoiceId: invoiceResult.id });
  } catch (error) {
    console.error('Erreur clôture carnet:', error);
    res.status(500).json({ message: 'Erreur lors de la clôture du carnet.', error });
  }
};
