import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  clients,
  products,
  salesInvoices,
  invoiceItems,
  chequeRegistry,
  cashPayments,
  quotes,
} from '../db/schema.js';

export const exportDataJson = async (_req: Request, res: Response) => {
  try {
    const [
      clientsRows,
      productsRows,
      invoicesRows,
      invoiceItemsRows,
      chequesRows,
      cashRows,
      quotesRows,
    ] = await Promise.all([
      db.select().from(clients),
      db.select().from(products),
      db.select().from(salesInvoices),
      db.select().from(invoiceItems),
      db.select().from(chequeRegistry),
      db.select().from(cashPayments),
      db.select().from(quotes),
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sa-company-export-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      clients: clientsRows,
      products: productsRows,
      salesInvoices: invoicesRows,
      invoiceItems: invoiceItemsRows,
      chequeRegistry: chequesRows,
      cashPayments: cashRows,
      quotes: quotesRows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur export.', error });
  }
};
