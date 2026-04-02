import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { clients, suppliers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logActivity } from '../services/auditLog.js';
import { normalizeWhatsAppDigits, sendEmail, sendWhatsAppPdfDocument } from '../services/messaging.js';

function normalizePdfBase64(raw: string): string {
  const s = String(raw || '').trim();
  const m = /^data:application\/pdf;base64,(.+)$/i.exec(s);
  return (m?.[1] ?? s).replace(/\s/g, '');
}

export const sendDocumentToRecipient = async (req: Request, res: Response) => {
  const uid = (req as { user?: { id: number } }).user?.id;
  const channel = String(req.body?.channel || '').toLowerCase();
  const target = String(req.body?.target || '').toLowerCase();
  const targetId = parseInt(String(req.body?.targetId || '0'), 10);
  const filename = String(req.body?.filename || 'document.pdf').trim() || 'document.pdf';
  const pdfRaw = String(req.body?.pdfBase64 || '');
  const subject = String(req.body?.subject || 'Document').trim() || 'Document';
  const caption = String(req.body?.caption || subject).trim();

  if (channel !== 'email' && channel !== 'whatsapp') {
    return res.status(400).json({ message: 'Canal invalide : email ou whatsapp.' });
  }
  if (target !== 'client' && target !== 'supplier') {
    return res.status(400).json({ message: 'Cible invalide : client ou supplier.' });
  }
  if (!targetId) {
    return res.status(400).json({ message: 'ID cible invalide.' });
  }

  const pdfBase64 = normalizePdfBase64(pdfRaw);
  if (!pdfBase64 || pdfBase64.length < 100) {
    return res.status(400).json({ message: 'PDF manquant ou trop court.' });
  }
  const approxBytes = (pdfBase64.length * 3) / 4;
  if (approxBytes > 14 * 1024 * 1024) {
    return res.status(400).json({ message: 'PDF trop volumineux (max. ~14 Mo).' });
  }

  try {
    let email: string | null | undefined;
    let phone: string | null | undefined;
    let entityLabel = '';

    if (target === 'client') {
      const [row] = await db.select().from(clients).where(eq(clients.id, targetId));
      if (!row) return res.status(404).json({ message: 'Client introuvable.' });
      email = row.email;
      phone = row.phone;
      entityLabel = row.name || 'client';
    } else {
      const [row] = await db.select().from(suppliers).where(eq(suppliers.id, targetId));
      if (!row) return res.status(404).json({ message: 'Fournisseur introuvable.' });
      email = row.email;
      phone = row.phone;
      entityLabel = row.name || 'fournisseur';
    }

    if (channel === 'email') {
      const to = (email || '').trim();
      if (!to) {
        return res.status(400).json({ message: `Aucune adresse e-mail pour ce ${target}.` });
      }
      const html = `<p><strong>${subject}</strong></p><p>Veuillez trouver le document en pièce jointe (${filename}).</p>`;
      const result = await sendEmail({
        to,
        subject,
        html,
        attachments: [{ filename, contentBase64: pdfBase64 }],
      });
      if (!result.ok) {
        return res.status(502).json({ message: result.error });
      }
      await logActivity(uid, 'send_document_email', target, targetId, { filename, entity: entityLabel });
      return res.json({ message: 'E-mail envoyé avec pièce jointe.' });
    }

    const phoneStr = (phone || '').trim();
    if (!phoneStr) {
      return res.status(400).json({ message: `Aucun numéro de téléphone pour ce ${target}.` });
    }
    const country = process.env.DEFAULT_PHONE_COUNTRY_CODE?.trim() || '212';
    const digits = normalizeWhatsAppDigits(phoneStr, country);
    if (!digits) {
      return res.status(400).json({ message: 'Numéro de téléphone invalide pour WhatsApp.' });
    }

    const result = await sendWhatsAppPdfDocument({
      toDigits: digits,
      filename,
      pdfBase64: pdfBase64,
      caption,
    });
    if (!result.ok) {
      return res.status(502).json({ message: result.error });
    }
    await logActivity(uid, 'send_document_whatsapp', target, targetId, { filename, entity: entityLabel });
    return res.json({ message: 'Document envoyé par WhatsApp.' });
  } catch (error) {
    console.error('sendDocumentToRecipient:', error);
    res.status(500).json({ message: 'Erreur envoi document.', error });
  }
};
