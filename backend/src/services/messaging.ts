/**
 * Intégrations externes : e-mail (Resend ou Gmail SMTP) et WhatsApp
 * (UltraMsg, Meta Cloud API ou Twilio). Voir backend/.env.example.
 */

import nodemailer from 'nodemailer';

export type MessagingStatus = {
  resendConfigured: boolean;
  gmailConfigured: boolean;
  /** Au moins un fournisseur e-mail prêt pour l’envoi. */
  emailConfigured: boolean;
  /** Fournisseur utilisé si les deux sont définis (sinon null ou seul actif). */
  activeEmailProvider: 'resend' | 'gmail' | null;
  whatsappConfigured: boolean;
  /** UltraMsg (instance + token présents). */
  ultramsgConfigured: boolean;
  /** Fournisseur WhatsApp réellement utilisé pour l’envoi. */
  activeWhatsAppProvider: 'ultramsg' | 'meta' | 'twilio' | null;
  emailFromHint: string | null;
};

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function hasGmail(): boolean {
  return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());
}

/** Quel backend utiliser pour l’e-mail. Si les deux sont configurés : EMAIL_PROVIDER=resend|gmail (défaut resend). */
export function pickEmailProvider(): 'resend' | 'gmail' | null {
  const prefer = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const r = hasResend();
  const g = hasGmail();
  if (prefer === 'gmail' && g) return 'gmail';
  if (prefer === 'resend' && r) return 'resend';
  if (r && g) return 'resend';
  if (g) return 'gmail';
  if (r) return 'resend';
  return null;
}

function hasUltraMsg(): boolean {
  return Boolean(process.env.ULTRAMSG_INSTANCE_ID?.trim() && process.env.ULTRAMSG_TOKEN?.trim());
}

function hasMetaWa(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

function hasTwilioWa(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
  );
}

/** Si plusieurs intégrations WhatsApp sont remplies : WHATSAPP_PROVIDER=ultramsg|meta|twilio (défaut : UltraMsg si présent). */
export function pickWhatsAppProvider(): 'ultramsg' | 'meta' | 'twilio' | null {
  const prefer = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  const u = hasUltraMsg();
  const m = hasMetaWa();
  const t = hasTwilioWa();
  if (prefer === 'ultramsg' && u) return 'ultramsg';
  if (prefer === 'meta' && m) return 'meta';
  if (prefer === 'twilio' && t) return 'twilio';
  if (u) return 'ultramsg';
  if (m) return 'meta';
  if (t) return 'twilio';
  return null;
}

export function getMessagingStatus(): MessagingStatus {
  const resendConfigured = hasResend();
  const gmailConfigured = hasGmail();
  const activeEmailProvider = pickEmailProvider();
  const ultramsgConfigured = hasUltraMsg();
  const activeWhatsAppProvider = pickWhatsAppProvider();
  const emailFromHint =
    activeEmailProvider === 'gmail'
      ? process.env.GMAIL_USER?.trim() || null
      : process.env.EMAIL_FROM?.trim() || process.env.GMAIL_USER?.trim() || null;
  return {
    resendConfigured,
    gmailConfigured,
    emailConfigured: activeEmailProvider !== null,
    activeEmailProvider,
    whatsappConfigured: activeWhatsAppProvider !== null,
    ultramsgConfigured,
    activeWhatsAppProvider,
    emailFromHint,
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type EmailAttachment = { filename: string; contentBase64: string };

/** Envoie un e-mail via le fournisseur configuré (Resend ou Gmail). */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true; id?: string; provider?: 'resend' | 'gmail' } | { ok: false; error: string }> {
  const p = pickEmailProvider();
  if (p === 'gmail') {
    const r = await sendGmailSmtp(params);
    if (!r.ok) return r;
    const out: { ok: true; provider: 'gmail'; id?: string } = { ok: true, provider: 'gmail' };
    if (r.messageId) out.id = r.messageId;
    return out;
  }
  if (p === 'resend') {
    const r = await sendResendEmail(params);
    if (!r.ok) return r;
    const out: { ok: true; provider: 'resend'; id?: string } = { ok: true, provider: 'resend' };
    if (r.id) out.id = r.id;
    return out;
  }
  return {
    ok: false,
    error:
      'Aucun e-mail configuré : Resend (RESEND_API_KEY + EMAIL_FROM) ou Gmail (GMAIL_USER + GMAIL_APP_PASSWORD).',
  };
}

async function sendGmailSmtp(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) {
    return { ok: false, error: 'GMAIL_USER ou GMAIL_APP_PASSWORD manquant dans .env' };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    const fromName = process.env.GMAIL_FROM_NAME?.trim() || 'Notification';
    const fromAddr = process.env.EMAIL_FROM?.trim() || user;
    const gmailAttachments =
      params.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64.replace(/^data:.*?;base64,/, ''), 'base64'),
        contentType: 'application/pdf',
      })) ?? [];
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: gmailAttachments.length ? gmailAttachments : undefined,
    });
    const out: { ok: true; messageId?: string } = { ok: true };
    if (info.messageId) out.messageId = info.messageId;
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Gmail SMTP: ${msg}` };
  }
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key) return { ok: false, error: 'RESEND_API_KEY manquant dans .env' };
  if (!from) return { ok: false, error: 'EMAIL_FROM manquant dans .env (ex. contact@votredomaine.com)' };

  const payload: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: a.contentBase64.replace(/^data:.*?;base64,/, ''),
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || res.statusText || 'Erreur Resend';
    return { ok: false, error: msg };
  }
  const out: { ok: true; id?: string } = { ok: true };
  if (data.id) out.id = data.id;
  return out;
}

/** Chiffres uniquement, sans + ; ex. 212612345678 pour le Maroc. */
export function normalizeWhatsAppDigits(phone: string, defaultCountry = '212'): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length >= 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) {
    return `${defaultCountry}${digits.slice(1)}`;
  }
  if (digits.length === 9 && defaultCountry === '212') {
    return `212${digits}`;
  }
  return digits;
}

/** https://ultramsg.com — instance liée à un numéro WhatsApp (QR code dans le tableau de bord). */
async function sendUltraMsgMessage(params: {
  toDigits: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID?.trim();
  const token = process.env.ULTRAMSG_TOKEN?.trim();
  if (!instanceId || !token) {
    return { ok: false, error: 'UltraMsg: ULTRAMSG_INSTANCE_ID ou ULTRAMSG_TOKEN manquant' };
  }

  const digits = params.toDigits.replace(/^\+/, '');
  const form = new URLSearchParams();
  form.set('token', token);
  form.set('to', `+${digits}`);
  form.set('body', stripHtml(params.text).slice(0, 4096));

  const url = `https://api.ultramsg.com/${encodeURIComponent(instanceId)}/messages/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sent?: string | boolean;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return { ok: false, error: `UltraMsg: ${data.error || data.message || res.statusText}` };
  }
  if (data.error) {
    return { ok: false, error: `UltraMsg: ${data.error}` };
  }
  return { ok: true };
}

async function sendUltraMsgDocument(params: {
  toDigits: string;
  filename: string;
  base64: string;
  caption: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID?.trim();
  const token = process.env.ULTRAMSG_TOKEN?.trim();
  if (!instanceId || !token) {
    return { ok: false, error: 'UltraMsg non configuré (ULTRAMSG_INSTANCE_ID, ULTRAMSG_TOKEN).' };
  }

  const digits = params.toDigits.replace(/^\+/, '');
  const form = new URLSearchParams();
  form.set('token', token);
  form.set('to', `+${digits}`);
  form.set('filename', params.filename.replace(/[^\w.\-()\s]/g, '_').slice(0, 255));
  form.set('document', params.base64.replace(/^data:.*?;base64,/, '').replace(/\s/g, ''));
  form.set('caption', stripHtml(params.caption).slice(0, 1024));

  const url = `https://api.ultramsg.com/${encodeURIComponent(instanceId)}/messages/document`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { sent?: string | boolean; error?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: `UltraMsg: ${data.error || data.message || res.statusText}` };
  }
  if (data.error) {
    return { ok: false, error: `UltraMsg: ${data.error}` };
  }
  return { ok: true };
}

/** PDF en pièce jointe WhatsApp (UltraMsg uniquement dans cette version). */
export async function sendWhatsAppPdfDocument(params: {
  toDigits: string;
  filename: string;
  pdfBase64: string;
  caption: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = pickWhatsAppProvider();
  if (p === 'ultramsg') {
    return sendUltraMsgDocument({
      toDigits: params.toDigits,
      filename: params.filename,
      base64: params.pdfBase64,
      caption: params.caption,
    });
  }
  return {
    ok: false,
    error:
      'Envoi PDF par WhatsApp : configurez UltraMsg. Meta/Twilio ne sont pas pris en charge pour les PDF ici.',
  };
}

/**
 * WhatsApp : UltraMsg (priorité par défaut), Meta Cloud API, ou Twilio.
 * Meta : pour un premier contact, un modèle approuvé peut être requis (WHATSAPP_TEMPLATE_*).
 */
export async function sendWhatsAppMessage(params: {
  toDigits: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = pickWhatsAppProvider();
  if (provider === 'ultramsg') {
    return sendUltraMsgMessage(params);
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

  if (provider === 'meta' && token && phoneId) {
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'fr';

    let body: Record<string, unknown>;
    if (templateName) {
      const noBodyVars = process.env.WHATSAPP_TEMPLATE_NO_BODY_VARS === '1';
      const templatePayload: Record<string, unknown> = {
        name: templateName,
        language: { code: templateLang },
      };
      if (!noBodyVars) {
        templatePayload.components = [
          {
            type: 'body',
            parameters: [{ type: 'text', text: params.text.slice(0, 1024) }],
          },
        ];
      }
      body = {
        messaging_product: 'whatsapp',
        to: params.toDigits,
        type: 'template',
        template: templatePayload,
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.toDigits,
        type: 'text',
        text: { preview_url: false, body: params.text.slice(0, 4096) },
      };
    }

    const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: { id?: string }[];
    };
    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data) || res.statusText;
      return { ok: false, error: `WhatsApp (Meta): ${msg}` };
    }
    return { ok: true };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const auth = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (provider === 'twilio' && sid && auth && from) {
    const to = `whatsapp:+${params.toDigits.replace(/^\+/, '')}`;
    const form = new URLSearchParams();
    form.set('To', to);
    form.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    form.set('Body', stripHtml(params.text).slice(0, 1600));

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error_message?: string };
    if (!res.ok) {
      return { ok: false, error: `Twilio: ${data.message || data.error_message || res.statusText}` };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error:
      'Aucune intégration WhatsApp : UltraMsg (ULTRAMSG_INSTANCE_ID + ULTRAMSG_TOKEN), ou Meta (WHATSAPP_*), ou Twilio (TWILIO_*) — voir .env.example',
  };
}
