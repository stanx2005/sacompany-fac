import type { Request, Response } from 'express';
import { db } from '../db';
import { purchaseOrders, purchaseOrderItems, suppliers, products, deliveryNotes, deliveryNoteItems } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const orders = await db.select({
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
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des bons de commande.', error });
  }
};

export const getPurchaseOrderItems = async (req: Request, res: Response) => {
  const { id } = req.params;
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
    .where(eq(purchaseOrderItems.purchaseOrderId, parseInt(id || '0')));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur items.', error });
  }
};

export const convertBCToBL = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ message: 'Un client est requis pour cette conversion.' });
  }

  try {
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id || '0')));
    if (!order) return res.status(404).json({ message: 'Bon de commande non trouvé.' });

    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, parseInt(id || '0')));
    
    const [blResult] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP',
      clientId: parseInt(clientId),
      date: new Date().toISOString().split('T')[0],
      totalInclTax: order.totalInclTax,
      status: 'pending'
    }).returning({ id: deliveryNotes.id });

    if (!blResult) throw new Error('Erreur lors de la création du bon de livraison.');

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
      const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
      totalInclTax += lineTotal;
      return { ...item, totalLine: lineTotal };
    });

    const [result] = await db.insert(purchaseOrders).values({
      orderNumber: 'TEMP',
      supplierId: parseInt(supplierId),
      date: String(date),
      totalInclTax,
      status: 'pending'
    }).returning({ id: purchaseOrders.id });

    if (!result) throw new Error('Erreur lors de la création du bon de commande.');

    const orderNumber = `BC-${result.id + 99}`;
    await db.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, result.id));

    for (const item of processedItems) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: result.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      });
    }
    res.status(201).json({ message: 'Bon de commande créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du BC.', error });
  }
};
