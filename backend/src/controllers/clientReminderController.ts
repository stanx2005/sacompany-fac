import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { clients, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logActivity } from '../services/auditLog.js';
import {
  getMessagingStatus,
  normalizeWhatsAppDigits,
  sendEmail,
  sendWhatsAppMessage,
} from '../services/messaging.js';

export const getMessagingStatusHandler = async (_req: Request, res: Response) => {
  try {
    res.json(getMessagingStatus());
  } catch (error) {
    res.status(500).json({ message: 'Erreur statut messagerie.', error });
  }
};

const KIND_LABELS: Record<string, string> = {
  paiement: 'paiement',
  livraison: 'livraison',
  facture: 'facture',
};

function buildDefaultMessage(kind: string, clientName: string, companyName: string): string {
  const k = KIND_LABELS[kind] || kind;
  return `Bonjour ${clientName},

Nous vous contactons concernant : ${k}.

Merci de prendre contact avec ${companyName} pour toute précision.

Cordialement,
${companyName}`;
}

export const sendClientReminder = async (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id || '0'), 10);
  const uid = (req as { user?: { id: number } }).user?.id;
  const channel = String(req.body?.channel || '').toLowerCase();
  const kind = String(req.body?.kind || 'facture').toLowerCase();
  const customMessage = req.body?.customMessage != null ? String(req.body.customMessage).trim() : '';

  if (!clientId) return res.status(400).json({ message: 'ID client invalide.' });
  if (channel !== 'email' && channel !== 'whatsapp') {
    return res.status(400).json({ message: 'Canal invalide : email ou whatsapp.' });
  }

  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });

    const [actor] = await db.select().from(users).where(eq(users.id, Number(uid || 0)));
    const companyName = actor?.companyName || 'Notre société';

    const textBody =
      customMessage ||
      buildDefaultMessage(kind, client.name || 'Madame, Monsieur', companyName);

    const subject = `Rappel — ${KIND_LABELS[kind] || kind} — ${companyName}`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;">${textBody
      .split('\n')
      .map((line) => `<p>${line.replace(/</g, '&lt;')}</p>`)
      .join('')}</div>`;

    if (channel === 'email') {
      const email = (client.email || '').trim();
      if (!email) {
        return res.status(400).json({ message: 'Ce client n’a pas d’adresse e-mail.' });
      }
      const result = await sendEmail({ to: email, subject, html });
      if (!result.ok) {
        return res.status(502).json({ message: result.error });
      }
      await logActivity(uid, 'client_reminder_email', 'client', clientId, { kind, to: email });
      return res.json({ message: 'E-mail envoyé.', channel: 'email' });
    }

    const phone = (client.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ message: 'Ce client n’a pas de numéro de téléphone.' });
    }
    const country = process.env.DEFAULT_PHONE_COUNTRY_CODE?.trim() || '212';
    const digits = normalizeWhatsAppDigits(phone, country);
    if (!digits) {
      return res.status(400).json({ message: 'Numéro de téléphone invalide pour WhatsApp.' });
    }

    const result = await sendWhatsAppMessage({ toDigits: digits, text: textBody });
    if (!result.ok) {
      return res.status(502).json({ message: result.error });
    }
    await logActivity(uid, 'client_reminder_whatsapp', 'client', clientId, { kind, to: digits });
    return res.json({ message: 'Message WhatsApp envoyé.', channel: 'whatsapp' });
  } catch (error) {
    console.error('sendClientReminder:', error);
    res.status(500).json({ message: 'Erreur envoi rappel.', error });
  }
};
