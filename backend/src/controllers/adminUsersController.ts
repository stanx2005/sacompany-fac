import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logActivity } from '../services/auditLog.js';

export const listUsers = async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id));
    res.json(rows);
  } catch (error) {
    console.error('listUsers:', error);
    res.status(500).json({ message: 'Erreur liste utilisateurs.', error });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const adminId = (req as { user?: { id: number } }).user?.id;
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const roleRaw = String(req.body?.role || 'staff');
  const role = roleRaw === 'admin' ? 'admin' : 'staff';

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nom, email et mot de passe requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Mot de passe : au moins 6 caractères.' });
  }

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [inserted] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role,
        companyName: 'SA COMPANY',
        companyICE: '000000000000000',
        companyAddress: 'Votre Adresse Ici, Casablanca',
        companyEmail: 'contact@sacompany.ma',
        companyPhone: '+212 5XX XX XX XX',
        companyRIB: '000 000 0000000000000000 00',
      } as any)
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!inserted) {
      return res.status(500).json({ message: 'Création impossible.' });
    }

    await logActivity(adminId, 'create', 'user', inserted.id, { email: inserted.email, role: inserted.role });

    res.status(201).json({
      message: 'Utilisateur créé.',
      user: inserted,
    });
  } catch (error) {
    console.error('createUser:', error);
    res.status(500).json({ message: 'Erreur création utilisateur.', error });
  }
};
