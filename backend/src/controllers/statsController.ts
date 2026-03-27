import type { Request, Response } from 'express';
import { db } from '../db';
import { salesInvoices, purchaseOrders, chequeRegistry, quotes } from '../db/schema';
import { sql } from 'drizzle-orm';

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
    }).from(chequeRegistry).where(sql`type = 'incoming' AND status = 'pending'`);

    // 4. Pending Cheques (Outgoing)
    const [outgoingCheques] = await db.select({
      total: sql<number>`sum(amount)`
    }).from(chequeRegistry).where(sql`type = 'outgoing' AND status = 'pending'`);

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

    res.json({
      totalSales: Number(salesResult?.total || 0),
      totalPurchases: Number(purchasesResult?.total || 0),
      pendingIncoming: Number(incomingCheques?.total || 0),
      pendingOutgoing: Number(outgoingCheques?.total || 0),
      totalQuotes: Number(quotesResult?.total || 0),
      chartData: chartData.map(d => ({ ...d, sales: Number(d.sales) })),
      purchaseChartData: purchaseChartData.map(d => ({ ...d, purchases: Number(d.purchases) }))
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.', error });
  }
};
