import type { Request, Response } from 'express';
import { db } from '../db';
import { suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const allSuppliers = await db.select().from(suppliers);
    res.json(allSuppliers);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des fournisseurs.', error });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.insert(suppliers).values({ name, email, phone, address, taxNumber });
    res.status(201).json({ message: 'Fournisseur créé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du fournisseur.', error });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { name, email, phone, address, taxNumber } = req.body;
  try {
    await db.update(suppliers)
      .set({ name, email, phone, address, taxNumber })
      .where(eq(suppliers.id, parseInt(id || '0')));
    res.json({ message: 'Fournisseur mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du fournisseur.', error });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    await db.delete(suppliers).where(eq(suppliers.id, parseInt(id || '0')));
    res.json({ message: 'Fournisseur supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du fournisseur.', error });
  }
};
