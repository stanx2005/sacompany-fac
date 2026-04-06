import React, { useState } from 'react';
import api from '../services/api';
import { Mail, MessageCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

type Props = {
  preparePdf: () => Promise<{ filename: string; base64: string }>;
  recipientType: 'client' | 'supplier';
  recipientId: number;
  subject: string;
  caption?: string;
  className?: string;
};

/** Deux boutons : envoi du PDF par e-mail (Resend/Gmail) ou WhatsApp (UltraMsg pour le PDF). */
export function SendDocumentActions({
  preparePdf,
  recipientType,
  recipientId,
  subject,
  caption,
  className = '',
}: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const isAccountant = role === 'accountant';
  const [busy, setBusy] = useState(false);

  const send = async (channel: 'email' | 'whatsapp') => {
    setBusy(true);
    try {
      const { filename, base64 } = await preparePdf();
      await api.post('/messaging/send-document', {
        channel,
        target: recipientType,
        targetId: recipientId,
        filename,
        pdfBase64: base64,
        subject,
        caption: caption || subject,
      });
      alert(channel === 'email' ? 'E-mail envoyé.' : 'WhatsApp envoyé.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        disabled={busy || isAccountant}
        onClick={() => void send('email')}
        title="Envoyer le PDF par e-mail"
        className="rounded-xl p-2 text-slate-400 transition-all hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
      </button>
      <button
        type="button"
        disabled={busy || isAccountant}
        onClick={() => void send('whatsapp')}
        title="Envoyer le PDF par WhatsApp (UltraMsg)"
        className="rounded-xl p-2 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
