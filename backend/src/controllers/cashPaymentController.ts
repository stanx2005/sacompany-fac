import type { Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cashPayments, chequeRegistry, clients, salesInvoices } from '../db/schema.js';

export const getCashPayments = async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: cashPayments.id,
        paymentNumber: cashPayments.paymentNumber,
        amount: cashPayments.amount,
        paymentDate: cashPayments.paymentDate,
        note: cashPayments.note,
        invoiceId: cashPayments.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        clientId: cashPayments.clientId,
        clientName: clients.name,
      })
      .from(cashPayments)
      .leftJoin(salesInvoices, eq(cashPayments.invoiceId, salesInvoices.id))
      .leftJoin(clients, eq(cashPayments.clientId, clients.id));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recuperation des paiements espece.', error });
  }
};

export const createCashPayment = async (req: Request, res: Response) => {
  try {
    const { invoiceId, clientId, amount, paymentDate, note } = req.body;
    const normalizedInvoiceId = Number(invoiceId || 0);
    const normalizedClientId = Number(clientId || 0);
    const normalizedAmount = Number(amount || 0);

    if (!normalizedInvoiceId || !normalizedClientId || !normalizedAmount || !paymentDate) {
      return res.status(400).json({ message: 'Facture, client, montant et date sont requis.' });
    }
    if (normalizedAmount <= 0) {
      return res.status(400).json({ message: 'Le montant doit etre superieur a 0.' });
    }

    const [invoice] = await db
      .select({
        id: salesInvoices.id,
        totalInclTax: salesInvoices.totalInclTax,
        clientId: salesInvoices.clientId,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.id, normalizedInvoiceId));

    if (!invoice) {
      return res.status(404).json({ message: 'Facture introuvable.' });
    }
    if (Number(invoice.clientId || 0) !== normalizedClientId) {
      return res.status(400).json({ message: 'Le client ne correspond pas a la facture.' });
    }

    const [cashSumRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(cashPayments)
      .where(eq(cashPayments.invoiceId, normalizedInvoiceId));

    const [chequeSumRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(chequeRegistry)
      .where(
        and(
          eq(chequeRegistry.invoiceId, normalizedInvoiceId),
          eq(chequeRegistry.type, 'incoming')
        )
      );

    const currentPaid = Number(cashSumRow?.total || 0) + Number(chequeSumRow?.total || 0);
    const invoiceTotal = Number(invoice.totalInclTax || 0);
    const nextPaid = currentPaid + normalizedAmount;
    if (nextPaid > invoiceTotal + 0.0001) {
      return res.status(400).json({
        message: `Paiement depasse le total facture. Reste autorise: ${(invoiceTotal - currentPaid).toFixed(2)} MAD`,
      });
    }

    const [inserted] = await db
      .insert(cashPayments)
      .values({
        paymentNumber: `TEMP-CASH-${Date.now()}`,
        invoiceId: normalizedInvoiceId,
        clientId: normalizedClientId,
        amount: normalizedAmount,
        paymentDate: String(paymentDate),
        note: note ? String(note) : null,
      } as any)
      .returning({ id: cashPayments.id });

    if (!inserted) {
      throw new Error('Creation du paiement espece echouee.');
    }

    const paymentNumber = `CASH-${Number(inserted.id) + 99}`;
    await db
      .update(cashPayments)
      .set({ paymentNumber })
      .where(eq(cashPayments.id, inserted.id));

    res.status(201).json({ message: 'Paiement espece enregistre.', id: inserted.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la creation du paiement espece.', error });
  }
};
