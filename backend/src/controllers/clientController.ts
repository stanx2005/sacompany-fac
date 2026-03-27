import type { Request, Response } from 'express';
import { db } from '../db';
import { clients, suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getClients = async (req: Request, res: Response) => {
  try {
    const allClients = await db.select().from(clients);
    res.json(allClients);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des clients.', error });
  }
};

export const createClient = async (req: Request, res: Response) => {
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.insert(clients).values({ name, email, phone, address, taxNumber });
    res.status(201).json({ message: 'Client créé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du client.', error });
  }
};

export const bulkCreateClients = async (req: Request, res: Response) => {
  const { clients: clientsList } = req.body;
  try {
    for (const c of clientsList) {
      await db.insert(clients).values({
        name: String(c.Nom || ''),
        email: String(c.Email || ''),
        phone: String(c.Telephone || ''),
        address: String(c.Adresse || ''),
        taxNumber: String(c.MatriculeFiscale || '')
      });
    }
    res.status(201).json({ message: `${clientsList.length} clients importés avec succès.` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'importation.', error });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.update(clients)
      .set({ name, email, phone, address, taxNumber })
      .where(eq(clients.id, parseInt(id || '0')));
    res.json({ message: 'Client mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du client.', error });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(clients).where(eq(clients.id, parseInt(id || '0')));
    res.json({ message: 'Client supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du client.', error });
  }
};
