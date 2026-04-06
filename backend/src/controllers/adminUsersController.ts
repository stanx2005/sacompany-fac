import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logActivity } from '../services/auditLog.js';

type AppRole = 'admin' | 'staff' | 'accountant';

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
  const role: AppRole = roleRaw === 'admin' || roleRaw === 'accountant' ? roleRaw : 'staff';

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

export const deleteUser = async (req: Request, res: Response) => {
  const adminId = Number((req as { user?: { id?: number } }).user?.id || 0);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  if (targetId === adminId) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  try {
    const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    if (target.role === 'admin') {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
      if (admins.length <= 1) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur.' });
      }
    }

    await db.delete(users).where(eq(users.id, targetId));
    await logActivity(adminId, 'delete', 'user', targetId, {
      email: target.email,
      role: target.role,
    });
    return res.json({ message: 'Utilisateur supprimé.' });
  } catch (error) {
    console.error('deleteUser:', error);
    return res.status(500).json({ message: 'Erreur suppression utilisateur.', error });
  }
};

export const resetUserPassword = async (req: Request, res: Response) => {
  const adminId = Number((req as { user?: { id?: number } }).user?.id || 0);
  const targetId = Number(req.params.id);
  const newPassword = String(req.body?.newPassword || '');
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Mot de passe : au moins 6 caractères.' });
  }

  try {
    const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashed }).where(eq(users.id, targetId));
    await logActivity(adminId, 'reset_password', 'user', targetId, {
      email: target.email,
      role: target.role,
    });
    return res.json({ message: 'Mot de passe utilisateur mis à jour.' });
  } catch (error) {
    console.error('resetUserPassword:', error);
    return res.status(500).json({ message: 'Erreur mise à jour mot de passe.', error });
  }
};
