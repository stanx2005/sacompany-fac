import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  products,
  deliveryNotes,
  deliveryNoteItems,
  purchaseInvoices,
  purchaseInvoiceItems,
} from '../db/schema.js';
import { eq, or, isNull } from 'drizzle-orm';
import { docNumber, getMainConfig } from '../services/appConfig.js';

const safeId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0] || '0';
  return id || '0';
};

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const includeArchived =
      req.query.includeArchived === '1' || String(req.query.includeArchived).toLowerCase() === 'true';

    const sel = {
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      date: purchaseOrders.date,
      totalInclTax: purchaseOrders.totalInclTax,
      status: purchaseOrders.status,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      taxNumber: suppliers.taxNumber,
      address: suppliers.address,
      phone: suppliers.phone,
      archived: purchaseOrders.archived,
    };

    let q = db.select(sel).from(purchaseOrders).leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id));
    if (!includeArchived) {
      q = q.where(or(eq(purchaseOrders.archived, 0), isNull(purchaseOrders.archived))) as typeof q;
    }
    const orders = await q;
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des bons de commande.', error });
  }
};

export const getPurchaseOrderItems = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  try {
    const items = await db.select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      productName: products.name,
      quantity: purchaseOrderItems.quantity,
      unitPrice: purchaseOrderItems.unitPrice,
      taxRate: purchaseOrderItems.taxRate,
      totalLine: purchaseOrderItems.totalLine,
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.purchaseOrderId, parseInt(id)));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur items.', error });
  }
};

export const convertBCToBL = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ message: 'Un client est requis pour cette conversion.' });
  }

  try {
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
    if (!order) return res.status(404).json({ message: 'Bon de commande non trouvé.' });

    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, parseInt(id)));
    
    const [blResult] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP-BL-' + Date.now(),
      clientId: Number(clientId),
      date: new Date().toISOString().split('T')[0],
      totalInclTax: Number(order.totalInclTax || 0),
      status: 'pending'
    } as any).returning({ id: deliveryNotes.id });

    if (!blResult) throw new Error('Erreur lors de la création du bon de livraison.');

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
    res.json({ message: 'Bon de Commande converti en Bon de Livraison avec succès.', blId: blResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  const { supplierId, date, items } = req.body;
  try {
    let totalInclTax = 0;
    const processedItems = items.map((item: any) => {
      const price = Number(item.unitPrice || 0);
      const taxRate = Number(item.taxRate || 20);
      const qty = Number(item.quantity || 0);
      const lineTotal = qty * price * (1 + taxRate / 100);
      totalInclTax += lineTotal;
      return { 
        productId: Number(item.productId),
        quantity: qty,
        unitPrice: price,
        taxRate: taxRate,
        totalLine: lineTotal 
      };
    });

    const [result] = await db.insert(purchaseOrders).values({
      orderNumber: 'TEMP-BC-' + Date.now(),
      supplierId: Number(supplierId || 0),
      date: String(date || new Date().toISOString().split('T')[0]),
      totalInclTax: Number(totalInclTax),
      status: 'pending',
      archived: 0,
    } as any).returning({ id: purchaseOrders.id });

    if (!result) throw new Error('Erreur lors de la création du bon de commande.');

    const cfg = await getMainConfig();
    const orderNumber = docNumber(cfg.numbering.bc, result.id);
    await db.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, result.id));

    for (const item of processedItems) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: result.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      } as any);
    }
    res.status(201).json({ message: 'Bon de commande créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du BC.', error });
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  const { supplierId, date, items } = req.body;
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Au moins un article est requis.' });
  }
  try {
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!row) return res.status(404).json({ message: 'Bon de commande non trouvé.' });

    let totalInclTax = 0;
    const processedItems = items.map((item: any) => {
      const price = Number(item.unitPrice || 0);
      const taxRate = Number(item.taxRate || 20);
      const qty = Number(item.quantity || 0);
      const lineTotal = qty * price * (1 + taxRate / 100);
      totalInclTax += lineTotal;
      return {
        productId: Number(item.productId || 0),
        quantity: qty,
        unitPrice: price,
        taxRate,
        totalLine: Number(lineTotal || 0),
      };
    });

    await db
      .update(purchaseOrders)
      .set({
        supplierId: Number(supplierId || 0),
        date: String(date || ''),
        totalInclTax: Number(totalInclTax),
      })
      .where(eq(purchaseOrders.id, id));

    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    for (const item of processedItems) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine,
      } as any);
    }

    res.json({ message: 'Bon de commande mis à jour.' });
  } catch (error) {
    console.error('updatePurchaseOrder:', error);
    res.status(500).json({ message: 'Erreur mise à jour BC.', error });
  }
};

export const archivePurchaseOrder = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });
  const archived =
    req.body?.archived === false || req.body?.archived === 0 || req.body?.archived === '0' ? 0 : 1;
  try {
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!row) return res.status(404).json({ message: 'Bon non trouvé.' });
    await db.update(purchaseOrders).set({ archived }).where(eq(purchaseOrders.id, id));
    res.json({ message: archived ? 'Bon archivé.' : 'Bon restauré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur archive.', error });
  }
};

export const deletePurchaseOrder = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });
  try {
    const linked = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.purchaseOrderId, id));
    if (linked.length) {
      return res.status(400).json({
        message: 'Impossible de supprimer : une facture achat est liée à ce bon. Archivez le bon ou supprimez la facture.',
      });
    }
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    res.json({ message: 'Bon de commande supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur suppression.', error });
  }
};

export const convertPOToPurchaseInvoice = async (req: Request, res: Response) => {
  const id = parseInt(safeId(req.params.id), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });

  const { invoiceNumber, date } = req.body as { invoiceNumber?: string; date?: string };

  try {
    const [existing] = await db
      .select({ id: purchaseInvoices.id })
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.purchaseOrderId, id));
    if (existing) {
      return res.status(400).json({ message: 'Ce bon de commande a déjà une facture achat liée.' });
    }

    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) return res.status(404).json({ message: 'Bon de commande non trouvé.' });

    const poItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    if (!poItems.length) {
      return res.status(400).json({ message: 'Le bon ne contient aucune ligne.' });
    }

    let totalExcl = 0;
    let totalIncl = 0;
    for (const it of poItems) {
      totalExcl += Number(it.quantity || 0) * Number(it.unitPrice || 0);
      totalIncl += Number(it.totalLine || 0);
    }
    totalExcl = Math.round(totalExcl * 100) / 100;
    totalIncl = Math.round(totalIncl * 100) / 100;
    const totalTax = Math.round((totalIncl - totalExcl) * 100) / 100;

    const num = String(invoiceNumber || '').trim() || `FACT-ACHAT-${Date.now()}`;
    const d = String(date || '').trim() || String(order.date);

    const [inv] = await db
      .insert(purchaseInvoices)
      .values({
        supplierId: order.supplierId,
        purchaseOrderId: id,
        invoiceNumber: num,
        date: d,
        totalExclTax: totalExcl,
        totalTax,
        totalInclTax: totalIncl,
        sourceType: 'from_order',
        notes: null,
        status: 'pending',
        archived: 0,
      } as any)
      .returning({ id: purchaseInvoices.id });

    if (!inv?.id) throw new Error('insert facture');

    for (const it of poItems) {
      await db.insert(purchaseInvoiceItems).values({
        purchaseInvoiceId: inv.id,
        productId: Number(it.productId || 0),
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        taxRate: Number(it.taxRate || 20),
        totalLine: Number(it.totalLine || 0),
      } as any);
    }

    res.status(201).json({ message: 'Facture achat créée depuis le bon de commande.', id: inv.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion en facture achat.', error });
  }
};
