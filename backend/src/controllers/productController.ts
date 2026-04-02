import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
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

type PreviewRow = { row: number; message: string };
type ValidProductRow = {
  name: string;
  description: string;
  price: number;
  taxRate: number;
  stock: number;
};

export const bulkPreviewProducts = async (req: Request, res: Response) => {
  const { products: productsList } = req.body as { products?: unknown[] };
  if (!Array.isArray(productsList)) {
    return res.status(400).json({ message: 'Liste produits invalide.' });
  }
  const errors: PreviewRow[] = [];
  const valid: ValidProductRow[] = [];
  productsList.forEach((raw, i) => {
    const p = raw as Record<string, unknown>;
    const name = String(p.Designation ?? p.name ?? '').trim();
    const price = parseFloat(String(p.PrixHT ?? p.price ?? '0'));
    if (!name) {
      errors.push({ row: i + 1, message: 'Désignation / nom manquant' });
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      errors.push({ row: i + 1, message: 'Prix HT invalide' });
      return;
    }
    valid.push({
      name,
      description: String(p.Description ?? p.description ?? ''),
      price,
      taxRate: parseFloat(String(p.TVA ?? p.taxRate ?? '20')) || 20,
      stock: parseInt(String(p.Stock ?? p.stock ?? '0'), 10) || 0,
    });
  });
  res.json({
    validCount: valid.length,
    errorCount: errors.length,
    valid,
    errors,
  });
};

export const bulkCreateProducts = async (req: Request, res: Response) => {
  const { products: productsList } = req.body;
  try {
    for (const p of productsList) {
      await db.insert(products).values({
        name: String(p.Designation || ''),
        description: String(p.Description || ''),
        price: parseFloat(String(p.PrixHT || '0')),
        taxRate: parseFloat(String(p.TVA || '20')),
        stock: parseInt(String(p.Stock || '0'))
      });
    }
    res.status(201).json({ message: `${productsList.length} produits importés avec succès.` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'importation.', error });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { name, description, price, taxRate, stock } = req.body;
  try {
    await db.update(products)
      .set({ name, description, price, taxRate, stock })
      .where(eq(products.id, parseInt(id || '0')));
    res.json({ message: 'Produit mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit.', error });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id: rawId } = req.params;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    await db.delete(products).where(eq(products.id, parseInt(id || '0')));
    res.json({ message: 'Produit supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit.', error });
  }
};
