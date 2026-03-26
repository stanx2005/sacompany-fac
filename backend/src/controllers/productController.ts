import { Request, Response } from 'express';
import { db } from '../db';
import { products } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const allProducts = await db.select().from(products);
    res.json(allProducts);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits.', error });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const { name, description, price, taxRate, stock } = req.body;
  try {
    await db.insert(products).values({ name, description, price, taxRate, stock });
    res.status(201).json({ message: 'Produit créé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du produit.', error });
  }
};

export const bulkCreateProducts = async (req: Request, res: Response) => {
  const { products: productsList } = req.body;
  try {
    for (const p of productsList) {
      await db.insert(products).values({
        name: p.Designation,
        description: p.Description || '',
        price: parseFloat(p.PrixHT),
        taxRate: parseFloat(p.TVA || '20'),
        stock: parseInt(p.Stock || '0')
      });
    }
    res.status(201).json({ message: `${productsList.length} produits importés avec succès.` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'importation.', error });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, taxRate, stock } = req.body;
  try {
    await db.update(products)
      .set({ name, description, price, taxRate, stock })
      .where(eq(products.id, parseInt(id)));
    res.json({ message: 'Produit mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit.', error });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(products).where(eq(products.id, parseInt(id)));
    res.json({ message: 'Produit supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit.', error });
  }
};
