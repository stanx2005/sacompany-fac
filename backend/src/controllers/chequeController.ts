import { Request, Response } from 'express';
import { db } from '../db';
import { chequeRegistry, clients, suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getCheques = async (req: Request, res: Response) => {
  try {
    const cheques = await db.select({
      id: chequeRegistry.id,
      chequeNumber: chequeRegistry.chequeNumber,
      bankName: chequeRegistry.bankName,
      amount: chequeRegistry.amount,
      issueDate: chequeRegistry.issueDate,
      dueDate: chequeRegistry.dueDate,
      type: chequeRegistry.type,
      status: chequeRegistry.status,
      isPaid: chequeRegistry.isPaid,
      clientId: chequeRegistry.clientId,
      supplierId: chequeRegistry.supplierId,
      clientName: clients.name,
      supplierName: suppliers.name,
    })
    .from(chequeRegistry)
    .leftJoin(clients, eq(chequeRegistry.clientId, clients.id))
    .leftJoin(suppliers, eq(chequeRegistry.supplierId, suppliers.id));
    
    res.json(cheques);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des chèques.', error });
  }
};

export const createCheque = async (req: Request, res: Response) => {
  try {
    await db.insert(chequeRegistry).values(req.body);
    res.status(201).json({ message: 'Chèque enregistré avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du chèque.', error });
  }
};

export const updateChequeStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, isPaid } = req.body;
  
  try {
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (isPaid !== undefined) updateData.isPaid = isPaid;

    await db.update(chequeRegistry)
      .set(updateData)
      .where(eq(chequeRegistry.id, parseInt(id)));
    res.json({ message: 'Chèque mis à jour.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du chèque.', error });
  }
};
