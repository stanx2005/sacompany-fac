import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  salesInvoices,
  purchaseOrders,
  chequeRegistry,
  quotes,
  cashPayments,
  clients,
} from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

export const getStats = async (req: Request, res: Response) => {
  try {
    // 1. Total Sales
    const [salesResult] = await db.select({
      total: sql<number>`sum(total_incl_tax)`
    }).from(salesInvoices);

    // 2. Total Purchases
    const [purchasesResult] = await db.select({
      total: sql<number>`sum(total_incl_tax)`
    }).from(purchaseOrders);

    // 3. Pending Cheques (Incoming)
    const [incomingCheques] = await db.select({
      total: sql<number>`sum(amount)`
    })
      .from(chequeRegistry)
      .where(
        sql`type = 'incoming' AND status = 'pending' AND COALESCE(${chequeRegistry.archived}, 0) = 0`
      );

    // 4. Pending Cheques (Outgoing)
    const [outgoingCheques] = await db.select({
      total: sql<number>`sum(amount)`
    })
      .from(chequeRegistry)
      .where(
        sql`type = 'outgoing' AND status = 'pending' AND COALESCE(${chequeRegistry.archived}, 0) = 0`
      );

    // 5. Total Quotes
    const [quotesResult] = await db.select({
      total: sql<number>`sum(total_incl_tax)`
    }).from(quotes);

    // 6. Chart Data (Last 30 days)
    const chartData = await db.select({
      date: salesInvoices.date,
      sales: sql<number>`sum(total_incl_tax)`
    })
    .from(salesInvoices)
    .groupBy(salesInvoices.date)
    .orderBy(salesInvoices.date)
    .limit(30);

    const purchaseChartData = await db.select({
      date: purchaseOrders.date,
      purchases: sql<number>`sum(total_incl_tax)`
    })
    .from(purchaseOrders)
    .groupBy(purchaseOrders.date)
    .orderBy(purchaseOrders.date)
    .limit(30);

    const [cashPaidTotal] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(cashPayments);

    const [chequePaidTotal] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(chequeRegistry)
      .where(
        sql`${chequeRegistry.type} = 'incoming' AND COALESCE(${chequeRegistry.archived}, 0) = 0`
      );

    const invRows = await db
      .select({
        id: salesInvoices.id,
        totalInclTax: salesInvoices.totalInclTax,
        clientId: salesInvoices.clientId,
      })
      .from(salesInvoices)
      .where(sql`COALESCE(${salesInvoices.archived}, 0) = 0`);

    let unpaidTotal = 0;
    for (const inv of invRows) {
      const [cashSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(cashPayments)
        .where(eq(cashPayments.invoiceId, inv.id));
      const [chequeSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(chequeRegistry)
        .where(
          and(
            eq(chequeRegistry.invoiceId, inv.id),
            eq(chequeRegistry.type, 'incoming'),
            sql`COALESCE(${chequeRegistry.archived}, 0) = 0`
          )
        );
      const paid = Number(cashSum?.total || 0) + Number(chequeSum?.total || 0);
      const total = Number(inv.totalInclTax || 0);
      const remaining = Math.max(total - paid, 0);
      if (remaining > 0.01) {
        unpaidTotal += remaining;
      }
    }

    const topClientsRaw = await db
      .select({
        clientId: salesInvoices.clientId,
        total: sql<number>`COALESCE(SUM(total_incl_tax), 0)`,
      })
      .from(salesInvoices)
      .where(sql`COALESCE(${salesInvoices.archived}, 0) = 0`)
      .groupBy(salesInvoices.clientId)
      .orderBy(sql`SUM(total_incl_tax) DESC`)
      .limit(5);

    const topClients: { clientId: number | null; clientName: string | null; totalSales: number }[] = [];
    for (const row of topClientsRaw) {
      if (!row.clientId) continue;
      const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, row.clientId)).limit(1);
      topClients.push({
        clientId: row.clientId,
        clientName: c?.name ?? null,
        totalSales: Number(row.total || 0),
      });
    }

    res.json({
      totalSales: Number(salesResult?.total || 0),
      totalPurchases: Number(purchasesResult?.total || 0),
      pendingIncoming: Number(incomingCheques?.total || 0),
      pendingOutgoing: Number(outgoingCheques?.total || 0),
      totalQuotes: Number(quotesResult?.total || 0),
      chartData: chartData.map((d: any) => ({ ...d, sales: Number(d.sales) })),
      purchaseChartData: purchaseChartData.map((d: any) => ({ ...d, purchases: Number(d.purchases) })),
      kpi: {
        unpaidReceivables: unpaidTotal,
        paidByCashTotal: Number(cashPaidTotal?.total || 0),
        paidByChequeIncomingTotal: Number(chequePaidTotal?.total || 0),
        topClients,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.', error });
  }
};
