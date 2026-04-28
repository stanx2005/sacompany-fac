import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { openTabs, clients, products, salesInvoices, invoiceItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { assignSequentialInvoiceNumberToRow, getMainConfig } from '../services/appConfig.js';

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
    await db.insert(openTabs).values({ 
      clientId: Number(clientId), 
      productId: Number(productId), 
      quantity: Number(quantity), 
      date: String(date || new Date().toISOString().split('T')[0]), 
      isClosed: 0 
    } as any);
    res.status(201).json({ message: 'Ajouté au carnet avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout au carnet.', error });
  }
};

export const updateTabItem = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return res.status(400).json({ message: 'ID manquant.' });

  const { productId, quantity, date } = req.body as {
    productId?: unknown;
    quantity?: unknown;
    date?: unknown;
  };

  try {
    const tabId = parseInt(id, 10);
    if (Number.isNaN(tabId)) return res.status(400).json({ message: 'ID invalide.' });

    const existing = await db
      .select({ id: openTabs.id })
      .from(openTabs)
      .where(and(eq(openTabs.id, tabId), eq(openTabs.isClosed, 0)))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Ligne introuvable ou déjà clôturée.' });
    }

    const updates: Record<string, unknown> = {};
    if (productId !== undefined) updates.productId = Number(productId);
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (date !== undefined) updates.date = String(date);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Aucun champ à mettre à jour.' });
    }
    if (updates.quantity !== undefined && (Number(updates.quantity) < 1 || Number.isNaN(Number(updates.quantity)))) {
      return res.status(400).json({ message: 'Quantité invalide.' });
    }

    await db.update(openTabs).set(updates as any).where(eq(openTabs.id, tabId));
    res.json({ message: 'Ligne du carnet mise à jour.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour.', error });
  }
};

export const deleteTabItem = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return res.status(400).json({ message: 'ID manquant.' });
  
  try {
    await db.delete(openTabs).where(eq(openTabs.id, parseInt(id)));
    res.json({ message: 'Article supprimé du carnet.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error });
  }
};

export const closeTabsForClient = async (req: Request, res: Response) => {
  const { clientId: rawClientId } = req.params;
  const clientId = Array.isArray(rawClientId) ? rawClientId[0] : rawClientId;
  if (!clientId) return res.status(400).json({ message: 'ID client manquant.' });

  try {
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

    let totalExclTax = 0;
    let totalTax = 0;
    const processedItems = items.map(item => {
      const price = Number(item.unitPrice || 0);
      const taxRate = Number(item.taxRate || 20);
      const qty = Number(item.quantity || 0);
      const lineExclTax = qty * price;
      const lineTax = lineExclTax * (taxRate / 100);
      totalExclTax += lineExclTax;
      totalTax += lineTax;
      return {
        productId: Number(item.productId),
        quantity: qty,
        unitPrice: price,
        taxRate: taxRate,
        totalLine: lineExclTax + lineTax,
        date: String(item.date || '')
      };
    });
    const totalInclTax = totalExclTax + totalTax;

    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP-TAB-' + Date.now(),
      clientId: parseInt(clientId),
      date: new Date().toISOString().split('T')[0],
      totalExclTax: Number(totalExclTax),
      totalTax: Number(totalTax),
      totalInclTax: Number(totalInclTax),
      status: 'pending',
      completed: 0,
    } as any).returning({ id: salesInvoices.id });

    if (!invoiceResult) throw new Error('Erreur lors de la création de la facture.');

    const cfg = await getMainConfig();
    await assignSequentialInvoiceNumberToRow(invoiceResult.id, cfg.numbering.invoice);

    for (const item of processedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine,
        date: item.date
      } as any);
    }

    await db.update(openTabs)
      .set({ isClosed: 1 })
      .where(and(eq(openTabs.clientId, parseInt(clientId)), eq(openTabs.isClosed, 0)));

    res.json({ message: 'Carnet clôturé et facture générée avec succès.', invoiceId: invoiceResult.id });
  } catch (error) {
    console.error('Erreur clôture carnet:', error);
    res.status(500).json({ message: 'Erreur lors de la clôture du carnet.', error });
  }
};
