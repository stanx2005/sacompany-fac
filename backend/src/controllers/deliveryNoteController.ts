import { Request, Response } from 'express';
import { db } from '../db';
import { deliveryNotes, deliveryNoteItems, clients, products, salesInvoices, invoiceItems } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const getDeliveryNotes = async (req: Request, res: Response) => {
  try {
    const notes = await db.select({
      id: deliveryNotes.id,
      noteNumber: deliveryNotes.noteNumber,
      date: deliveryNotes.date,
      totalInclTax: deliveryNotes.totalInclTax,
      status: deliveryNotes.status,
      clientId: deliveryNotes.clientId,
      clientName: clients.name,
      taxNumber: clients.taxNumber,
      address: clients.address,
      phone: clients.phone,
    })
    .from(deliveryNotes)
    .leftJoin(clients, eq(deliveryNotes.clientId, clients.id));
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des bons de livraison.', error });
  }
};

export const getDeliveryNoteItems = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const items = await db.select({
      id: deliveryNoteItems.id,
      productId: deliveryNoteItems.productId,
      productName: products.name,
      quantity: deliveryNoteItems.quantity,
      unitPrice: deliveryNoteItems.unitPrice,
      taxRate: deliveryNoteItems.taxRate,
      totalLine: deliveryNoteItems.totalLine,
    })
    .from(deliveryNoteItems)
    .leftJoin(products, eq(deliveryNoteItems.productId, products.id))
    .where(eq(deliveryNoteItems.deliveryNoteId, parseInt(id)));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur items.', error });
  }
};

export const markAsDelivered = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 1. Get BL items
    const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, parseInt(id)));
    
    // 2. Deduct stock for each item
    for (const item of items) {
      await db.update(products)
        .set({ stock: sql`stock - ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }

    // 3. Update status
    await db.update(deliveryNotes)
      .set({ status: 'delivered' })
      .where(eq(deliveryNotes.id, parseInt(id)));

    res.json({ message: 'Bon de livraison marqué comme livré et stock mis à jour.' });
  } catch (error) {
    console.error('Delivered error:', error);
    res.status(500).json({ message: 'Erreur lors de la livraison.', error });
  }
};

export const convertBLToInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [bl] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, parseInt(id)));
    const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, parseInt(id)));
    
    let totalExclTax = 0;
    let totalTax = 0;
    for (const item of items) {
      const lineExclTax = item.quantity * item.unitPrice;
      totalExclTax += lineExclTax;
      totalTax += lineExclTax * (item.taxRate / 100);
    }

    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP',
      clientId: bl.clientId,
      date: new Date().toISOString().split('T')[0],
      totalExclTax,
      totalTax,
      totalInclTax: bl.totalInclTax,
      status: 'pending'
    }).returning({ id: salesInvoices.id });

    const invoiceNumber = `FACT-CONV-${invoiceResult.id + 99}`;
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceResult.id));

    for (const item of items) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      });
    }
    
    await db.update(deliveryNotes).set({ status: 'invoiced' }).where(eq(deliveryNotes.id, parseInt(id)));
    
    res.json({ message: 'Bon de livraison converti en Facture avec succès.', invoiceId: invoiceResult.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur conversion.', error });
  }
};

export const createDeliveryNote = async (req: Request, res: Response) => {
  const { clientId, date, items } = req.body;
  try {
    let totalInclTax = 0;
    const processedItems = items.map((item: any) => {
      const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
      totalInclTax += lineTotal;
      return { ...item, totalLine: lineTotal };
    });

    const [result] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP',
      clientId,
      date,
      totalInclTax,
      status: 'pending'
    }).returning({ id: deliveryNotes.id });

    const noteNumber = `BL-${result.id + 99}`;
    await db.update(deliveryNotes).set({ noteNumber }).where(eq(deliveryNotes.id, result.id));

    for (const item of processedItems) {
      await db.insert(deliveryNoteItems).values({
        deliveryNoteId: result.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalLine: item.totalLine
      });
    }
    res.status(201).json({ message: 'Bon de livraison créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du BL.', error });
  }
};
