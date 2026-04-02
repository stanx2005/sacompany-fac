import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { deliveryNotes, deliveryNoteItems, clients, products, salesInvoices, invoiceItems } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logActivity } from '../services/auditLog.js';
import { docNumber, getMainConfig } from '../services/appConfig.js';

const safeId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0] || '0';
  return id || '0';
};

export const getDeliveryNotes = async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const base = db
      .select({
        id: deliveryNotes.id,
        noteNumber: deliveryNotes.noteNumber,
        date: deliveryNotes.date,
        totalInclTax: deliveryNotes.totalInclTax,
        status: deliveryNotes.status,
        archived: deliveryNotes.archived,
        completed: deliveryNotes.completed,
        clientId: deliveryNotes.clientId,
        clientName: clients.name,
        taxNumber: clients.taxNumber,
        address: clients.address,
        phone: clients.phone,
      })
      .from(deliveryNotes)
      .leftJoin(clients, eq(deliveryNotes.clientId, clients.id));

    const notes = includeArchived
      ? await base
      : await base.where(sql`COALESCE(${deliveryNotes.archived}, 0) = 0`);

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des bons de livraison.', error });
  }
};

export const getDeliveryNoteItems = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
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
  const id = safeId(req.params.id);
  try {
    const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, parseInt(id)));
    
    for (const item of items) {
      if (item.productId) {
        await db.update(products)
          .set({ stock: sql`stock - ${Number(item.quantity || 0)}` })
          .where(eq(products.id, item.productId));
      }
    }

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
  const id = safeId(req.params.id);
  try {
    const [bl] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, parseInt(id)));
    if (!bl) return res.status(404).json({ message: 'Bon de livraison non trouvé.' });
    const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, parseInt(id)));
    
    let totalExclTax = 0;
    let totalTax = 0;
    for (const item of items) {
      const lineExclTax = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      totalExclTax += lineExclTax;
      totalTax += lineExclTax * (Number(item.taxRate || 20) / 100);
    }

    const [invoiceResult] = await db.insert(salesInvoices).values({
      invoiceNumber: 'TEMP-INV-' + Date.now(),
      clientId: Number(bl.clientId || 0),
      date: new Date().toISOString().split('T')[0] || '',
      totalExclTax: Number(totalExclTax),
      totalTax: Number(totalTax),
      totalInclTax: Number(bl.totalInclTax || 0),
      status: 'pending',
      completed: 0,
    } as any).returning({ id: salesInvoices.id });

    if (!invoiceResult) throw new Error('Erreur facture.');

    const cfg = await getMainConfig();
    const invoiceNumber = docNumber(cfg.numbering.invoiceConv, invoiceResult.id);
    await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceResult.id));

    for (const item of items) {
      await db.insert(invoiceItems).values({
        invoiceId: invoiceResult.id,
        productId: Number(item.productId || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
        totalLine: Number(item.totalLine || 0),
        date: new Date().toISOString().split('T')[0] || ''
      } as any);
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
      const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 + Number(item.taxRate || 20) / 100);
      totalInclTax += lineTotal;
      return { ...item, totalLine: lineTotal };
    });

    const [result] = await db.insert(deliveryNotes).values({
      noteNumber: 'TEMP-BL-' + Date.now(),
      clientId: Number(clientId || 0),
      date: String(date || ''),
      totalInclTax: Number(totalInclTax),
      status: 'pending',
      archived: 0,
      completed: 0,
    } as any).returning({ id: deliveryNotes.id });

    if (!result) throw new Error('Erreur BL.');

    const cfg = await getMainConfig();
    const noteNumber = docNumber(cfg.numbering.bl, result.id);
    await db.update(deliveryNotes).set({ noteNumber }).where(eq(deliveryNotes.id, result.id));

    for (const item of processedItems) {
      await db.insert(deliveryNoteItems).values({
        deliveryNoteId: result.id,
        productId: Number(item.productId || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
        totalLine: Number(item.totalLine || 0)
      } as any);
    }
    res.status(201).json({ message: 'Bon de livraison créé.', id: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur BL.', error });
  }
};

export const setDeliveryNoteArchived = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const noteId = parseInt(id || '0', 10);
  const archived = Boolean(req.body?.archived);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db
      .update(deliveryNotes)
      .set({ archived: archived ? 1 : 0 })
      .where(eq(deliveryNotes.id, noteId));
    await logActivity(uid, archived ? 'archive' : 'unarchive', 'delivery_note', noteId, {});
    res.json({ message: archived ? 'Bon de livraison archivé.' : 'Bon de livraison restauré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const setDeliveryNoteCompleted = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const noteId = parseInt(id || '0', 10);
  const completed = Boolean(req.body?.completed);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    await db
      .update(deliveryNotes)
      .set({ completed: completed ? 1 : 0 })
      .where(eq(deliveryNotes.id, noteId));
    await logActivity(uid, completed ? 'mark_complete' : 'unmark_complete', 'delivery_note', noteId, {});
    res.json({ message: completed ? 'Bon marqué comme terminé.' : 'Marquage retiré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error });
  }
};

export const deleteDeliveryNote = async (req: Request, res: Response) => {
  const id = safeId(req.params.id);
  const noteId = parseInt(id || '0', 10);
  const uid = (req as { user?: { id: number } }).user?.id;
  try {
    const [bl] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, noteId));
    if (!bl) {
      return res.status(404).json({ message: 'Bon de livraison non trouvé.' });
    }
    if (!Number(bl.completed || 0)) {
      return res.status(400).json({
        message: 'Marquez le bon comme « terminé » avant de le supprimer.',
      });
    }
    await db.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, noteId));
    await db.delete(deliveryNotes).where(eq(deliveryNotes.id, noteId));
    await logActivity(uid, 'delete', 'delivery_note', noteId, {});
    res.json({ message: 'Bon de livraison supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur suppression.', error });
  }
};
