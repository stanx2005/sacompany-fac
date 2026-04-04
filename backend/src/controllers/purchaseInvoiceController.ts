import type { Request, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { db } from '../db/index.js';
import { purchaseInvoices, purchaseInvoiceItems, suppliers, purchaseOrders, products } from '../db/schema.js';
import { desc, eq, or, isNull } from 'drizzle-orm';

const UPLOAD_SUBDIR = 'purchase-invoices';
const allowedExt = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', UPLOAD_SUBDIR);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = allowedExt.has(ext) ? ext : '.bin';
    cb(null, `${randomUUID()}${safe}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (allowedExt.has(ext)) cb(null, true);
  else cb(new Error('Format non accepté : PDF ou image (PNG, JPG, WEBP, GIF).'));
};

export const purchaseInvoiceUploadMiddleware = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});

function ttcToHtTax(ttc: number, taxRatePercent: number): { ht: number; tax: number } {
  if (ttc <= 0) return { ht: 0, tax: 0 };
  const r = taxRatePercent / 100;
  const ht = ttc / (1 + r);
  const tax = ttc - ht;
  return { ht: Math.round(ht * 100) / 100, tax: Math.round(tax * 100) / 100 };
}

function processLineItems(items: any[]): {
  processed: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalLine: number;
  }>;
  totalExclTax: number;
  totalTax: number;
  totalInclTax: number;
} {
  let totalExcl = 0;
  let totalIncl = 0;
  const processed = items.map((item: any) => {
    const price = Number(item.unitPrice || 0);
    const taxRate = Number(item.taxRate ?? 20);
    const qty = Number(item.quantity || 0);
    const ht = qty * price;
    const lineTtc = qty * price * (1 + taxRate / 100);
    totalExcl += ht;
    totalIncl += lineTtc;
    return {
      productId: Number(item.productId),
      quantity: qty,
      unitPrice: price,
      taxRate,
      totalLine: Math.round(lineTtc * 100) / 100,
    };
  });
  const totalTax = Math.round((totalIncl - totalExcl) * 100) / 100;
  return {
    processed,
    totalExclTax: Math.round(totalExcl * 100) / 100,
    totalTax,
    totalInclTax: Math.round(totalIncl * 100) / 100,
  };
}

function safeResolveFile(rel: string | null): string | null {
  if (!rel || rel.includes('..')) return null;
  if (!rel.startsWith(`${UPLOAD_SUBDIR}/`)) return null;
  const abs = path.join(process.cwd(), 'uploads', rel);
  const root = path.join(process.cwd(), 'uploads', UPLOAD_SUBDIR);
  if (!abs.startsWith(root)) return null;
  return abs;
}

export const listPurchaseInvoices = async (req: Request, res: Response) => {
  try {
    const includeArchived =
      req.query.includeArchived === '1' || String(req.query.includeArchived).toLowerCase() === 'true';

    const sel = {
      id: purchaseInvoices.id,
      supplierId: purchaseInvoices.supplierId,
      supplierName: suppliers.name,
      purchaseOrderId: purchaseInvoices.purchaseOrderId,
      purchaseOrderNumber: purchaseOrders.orderNumber,
      invoiceNumber: purchaseInvoices.invoiceNumber,
      date: purchaseInvoices.date,
      totalExclTax: purchaseInvoices.totalExclTax,
      totalTax: purchaseInvoices.totalTax,
      totalInclTax: purchaseInvoices.totalInclTax,
      sourceType: purchaseInvoices.sourceType,
      filePath: purchaseInvoices.filePath,
      fileMime: purchaseInvoices.fileMime,
      originalFilename: purchaseInvoices.originalFilename,
      notes: purchaseInvoices.notes,
      status: purchaseInvoices.status,
      archived: purchaseInvoices.archived,
      createdAt: purchaseInvoices.createdAt,
    };

    let q = db
      .select(sel)
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(purchaseOrders, eq(purchaseInvoices.purchaseOrderId, purchaseOrders.id));

    if (!includeArchived) {
      q = q.where(
        or(eq(purchaseInvoices.archived, 0), isNull(purchaseInvoices.archived))
      ) as typeof q;
    }

    const rows = await q.orderBy(desc(purchaseInvoices.id));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des factures achat.', error });
  }
};

export const getPurchaseInvoiceItems = async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id ?? ''), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });
  try {
    const items = await db
      .select({
        id: purchaseInvoiceItems.id,
        productId: purchaseInvoiceItems.productId,
        productName: products.name,
        quantity: purchaseInvoiceItems.quantity,
        unitPrice: purchaseInvoiceItems.unitPrice,
        taxRate: purchaseInvoiceItems.taxRate,
        totalLine: purchaseInvoiceItems.totalLine,
      })
      .from(purchaseInvoiceItems)
      .leftJoin(products, eq(purchaseInvoiceItems.productId, products.id))
      .where(eq(purchaseInvoiceItems.purchaseInvoiceId, id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lignes facture.', error });
  }
};

export const createManualPurchaseInvoice = async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const { supplierId, invoiceNumber, date, notes, items } = body;

    const num = String(invoiceNumber || '').trim();
    if (!num) return res.status(400).json({ message: 'Numéro de facture requis.' });
    const d = String(date || '').trim();
    if (!d) return res.status(400).json({ message: 'Date requise.' });

    const sid =
      supplierId === '' || supplierId === undefined || supplierId === null
        ? null
        : parseInt(String(supplierId), 10);
    if (sid !== null && Number.isNaN(sid)) {
      return res.status(400).json({ message: 'Fournisseur invalide.' });
    }

    let totalExclTax: number;
    let totalTax: number;
    let totalInclTax: number;
    let rowsToInsert: ReturnType<typeof processLineItems>['processed'] | null = null;

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (!it.productId || Number(it.quantity) < 1) {
          return res.status(400).json({ message: 'Chaque ligne doit avoir un produit et une quantité.' });
        }
      }
      const { processed, totalExclTax: ex, totalTax: tx, totalInclTax: inc } = processLineItems(items);
      totalExclTax = ex;
      totalTax = tx;
      totalInclTax = inc;
      rowsToInsert = processed;
    } else {
      const ttc = parseFloat(String(body.totalInclTax));
      if (Number.isNaN(ttc) || ttc < 0) {
        return res.status(400).json({ message: 'Montant TTC invalide ou ajoutez des lignes produits.' });
      }
      const rate = parseFloat(String(body.taxRate ?? '20'));
      const tr = Number.isNaN(rate) || rate < 0 ? 20 : rate;
      const calc = ttcToHtTax(ttc, tr);
      totalExclTax = calc.ht;
      totalTax = calc.tax;
      totalInclTax = ttc;
    }

    const [row] = await db
      .insert(purchaseInvoices)
      .values({
        supplierId: sid,
        invoiceNumber: num,
        date: d,
        totalExclTax,
        totalTax,
        totalInclTax,
        sourceType: 'manual',
        notes: notes ? String(notes) : null,
        status: 'pending',
        archived: 0,
      } as any)
      .returning({ id: purchaseInvoices.id });

    const invId = row?.id;
    if (!invId) throw new Error('insert invoice');

    if (rowsToInsert) {
      for (const it of rowsToInsert) {
        await db.insert(purchaseInvoiceItems).values({
          purchaseInvoiceId: invId,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          totalLine: it.totalLine,
        } as any);
      }
    }

    res.status(201).json({ message: 'Facture enregistrée.', id: invId });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création.', error });
  }
};

export const createUploadedPurchaseInvoice = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Fichier requis (PDF ou image).' });

    const {
      supplierId,
      invoiceNumber,
      date,
      totalInclTax,
      taxRate,
      notes,
      purchaseOrderId,
    } = req.body as Record<string, string | undefined>;

    const d = String(date || '').trim() || new Date().toISOString().split('T')[0];
    let num = String(invoiceNumber || '').trim();
    if (!num) num = `FACT-ACHAT-${Date.now()}`;

    let ttc = parseFloat(String(totalInclTax || '0'));
    if (Number.isNaN(ttc) || ttc < 0) ttc = 0;
    const rate = parseFloat(String(taxRate ?? '20'));
    const tr = Number.isNaN(rate) || rate < 0 ? 20 : rate;
    const { ht, tax } = ttcToHtTax(ttc, tr);

    const sidRaw = supplierId === '' || supplierId === undefined ? null : parseInt(String(supplierId), 10);
    const sid = sidRaw !== null && !Number.isNaN(sidRaw) ? sidRaw : null;

    let poId: number | null = null;
    if (purchaseOrderId !== undefined && purchaseOrderId !== '' && purchaseOrderId !== null) {
      const p = parseInt(String(purchaseOrderId), 10);
      if (!Number.isNaN(p)) poId = p;
    }

    const relPath = `${UPLOAD_SUBDIR}/${file.filename}`;

    const [row] = await db
      .insert(purchaseInvoices)
      .values({
        supplierId: sid,
        purchaseOrderId: poId,
        invoiceNumber: num,
        date: d,
        totalExclTax: ht,
        totalTax: tax,
        totalInclTax: ttc,
        sourceType: 'upload',
        filePath: relPath,
        fileMime: file.mimetype || null,
        originalFilename: file.originalname || file.filename,
        notes: notes ? String(notes) : null,
        status: 'pending',
        archived: 0,
      } as any)
      .returning({ id: purchaseInvoices.id });

    res.status(201).json({ message: 'Facture importée.', id: row?.id });
  } catch (error: any) {
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch {
        /* ignore */
      }
    }
    const msg = error?.message || 'Erreur import.';
    res.status(500).json({ message: msg, error });
  }
};

export const getPurchaseInvoiceAttachment = async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id ?? ''), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });

  const disposition = String(req.query.disposition || 'inline') === 'attachment' ? 'attachment' : 'inline';

  try {
    const [row] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    if (!row?.filePath) return res.status(404).json({ message: 'Aucune pièce jointe.' });

    const abs = safeResolveFile(row.filePath);
    if (!abs || !fs.existsSync(abs)) return res.status(404).json({ message: 'Fichier introuvable.' });

    const mime = row.fileMime || 'application/octet-stream';
    const name = row.originalFilename || 'facture';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);

    const stream = createReadStream(abs);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lecture fichier.', error });
  }
};

export const archivePurchaseInvoice = async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id ?? ''), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });
  const archived =
    req.body?.archived === false || req.body?.archived === 0 || req.body?.archived === '0' ? 0 : 1;
  try {
    const [row] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    if (!row) return res.status(404).json({ message: 'Facture introuvable.' });
    await db.update(purchaseInvoices).set({ archived }).where(eq(purchaseInvoices.id, id));
    res.json({ message: archived ? 'Facture archivée.' : 'Facture restaurée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur archive.', error });
  }
};

export const deletePurchaseInvoice = async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id ?? ''), 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide.' });

  try {
    const [row] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    if (!row) return res.status(404).json({ message: 'Facture introuvable.' });

    if (row.filePath) {
      const abs = safeResolveFile(row.filePath);
      if (abs && fs.existsSync(abs)) {
        await fsPromises.unlink(abs).catch(() => {});
      }
    }

    await db.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, id));
    await db.delete(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    res.json({ message: 'Facture supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur suppression.', error });
  }
};
