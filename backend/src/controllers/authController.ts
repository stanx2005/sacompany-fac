import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, String(email)),
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    await db.insert(users).values({
      name: String(name),
      email: String(email),
      password: hashedPassword,
      companyName: 'SA COMPANY',
      companyICE: '000000000000000',
      companyAddress: 'Votre Adresse Ici, Casablanca',
      companyEmail: 'contact@sacompany.ma',
      companyPhone: '+212 5XX XX XX XX',
      companyRIB: '000 000 0000000000000000 00'
    });

    res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'inscription.', error });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, String(email)),
    });

    if (!user) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const validPassword = await bcrypt.compare(String(password), user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        companyName: user.companyName,
        companyICE: user.companyICE,
        companyAddress: user.companyAddress,
        companyEmail: user.companyEmail,
        companyPhone: user.companyPhone,
        companyRIB: user.companyRIB
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion.', error });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, email, companyName, companyICE, companyAddress, companyEmail, companyPhone, companyRIB } = req.body;

  try {
    await db.update(users)
      .set({ 
        name: String(name), 
        email: String(email), 
        companyName: String(companyName), 
        companyICE: String(companyICE), 
        companyAddress: String(companyAddress), 
        companyEmail: String(companyEmail), 
        companyPhone: String(companyPhone), 
        companyRIB: String(companyRIB) 
      })
      .where(eq(users.id, Number(userId)));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, Number(userId)),
    });

    if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    res.json({ 
      message: 'Profil mis à jour avec succès.', 
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        companyName: updatedUser.companyName,
        companyICE: updatedUser.companyICE,
        companyAddress: updatedUser.companyAddress,
        companyEmail: updatedUser.companyEmail,
        companyPhone: updatedUser.companyPhone,
        companyRIB: updatedUser.companyRIB
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil.', error });
  }
};
