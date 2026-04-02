import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { translateChequeStatus, translateChequeType } from '../utils/chequeLabels';
import {
  Bell,
  Calendar,
  CreditCard,
  FileWarning,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';

type NotifPayload = {
  upcomingCheques: Array<{
    id: number;
    chequeNumber: string;
    dueDate: string;
    amount: number;
    clientName: string | null;
  }>;
  overdueInvoices: Array<{
    id: number;
    invoiceNumber: string;
    date: string;
    remaining: number;
    clientName: string | null;
  }>;
  userRemindersDue: Array<{ id: number; title: string; dueDate: string; note: string | null }>;
};

type ReminderRow = {
  id: number;
  userId: number;
  clientId: number | null;
  clientName: string | null;
  chequeId: number | null;
  chequeNumber: string | null;
  chequeBankName: string | null;
  chequeAmount: number | null;
  chequeIssueDate: string | null;
  chequeDueDate: string | null;
  chequeType: string | null;
  chequeStatus: string | null;
  chequeInvoiceNumber: string | null;
  chequeClientName: string | null;
  title: string;
  note: string | null;
  dueDate: string;
  completed: number | null;
  createdAt?: Date | string | null;
};

type ChequeOption = {
  id: number;
  chequeNumber: string;
  bankName: string | null;
  amount: number;
  issueDate: string;
  dueDate: string;
  type: string;
  status: string | null;
  clientName: string | null;
  invoiceNumber: string | null;
};

type ClientOption = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

type MsgStatus = {
  emailConfigured: boolean;
  whatsappConfigured: boolean;
};

function formatChequePickLabel(c: ChequeOption): string {
  const amt = Number(c.amount || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 });
  const who = c.clientName?.trim() ? ` · ${c.clientName}` : '';
  return `${c.chequeNumber} — ${amt} MAD — éch. ${c.dueDate}${who}`;
}

function buildReminderMessage(r: ReminderRow): string {
  const parts: string[] = [r.title.trim()];
  if (r.note?.trim()) {
    parts.push('', r.note.trim());
  }
  parts.push('', `Échéance rappel : ${r.dueDate}`);
  if (r.chequeId && (r.chequeNumber != null || r.chequeAmount != null)) {
    parts.push('', '— Chèque —');
    if (r.chequeNumber) parts.push(`N° ${r.chequeNumber}`);
    if (r.chequeBankName) parts.push(`Banque : ${r.chequeBankName}`);
    if (r.chequeAmount != null) {
      parts.push(
        `Montant : ${Number(r.chequeAmount).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`
      );
    }
    if (r.chequeIssueDate) parts.push(`Émission : ${r.chequeIssueDate}`);
    if (r.chequeDueDate) parts.push(`Échéance chèque : ${r.chequeDueDate}`);
    if (r.chequeType) {
      parts.push(`Type : ${translateChequeType(r.chequeType)}`);
    }
    if (r.chequeStatus) parts.push(`Statut : ${translateChequeStatus(r.chequeStatus)}`);
    if (r.chequeInvoiceNumber) parts.push(`Facture : ${r.chequeInvoiceNumber}`);
    if (r.chequeClientName?.trim()) parts.push(`Client (chèque) : ${r.chequeClientName.trim()}`);
  }
  return parts.join('\n');
}

const Reminders = () => {
  const [system, setSystem] = useState<NotifPayload | null>(null);
  const [list, setList] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [cheques, setCheques] = useState<ChequeOption[]>([]);
  const [msgStatus, setMsgStatus] = useState<MsgStatus | null>(null);
  const [form, setForm] = useState({
    title: '',
    note: '',
    dueDate: new Date().toISOString().split('T')[0],
    clientId: '' as string,
    chequeId: '' as string,
  });
  const [sendCtx, setSendCtx] = useState<{
    reminder: ReminderRow;
    channel: 'email' | 'whatsapp';
    client: ClientOption;
  } | null>(null);
  const [sendKind, setSendKind] = useState<'paiement' | 'livraison' | 'facture'>('facture');
  const [sendCustom, setSendCustom] = useState('');
  const [sending, setSending] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [notifRes, remRes, clientsRes, chequesRes, msgRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/reminders'),
        api.get('/clients'),
        api.get('/cheques'),
        api.get('/clients/messaging/status'),
      ]);
      setSystem(notifRes.data);
      setList(remRes.data || []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setCheques(Array.isArray(chequesRes.data) ? chequesRes.data : []);
      setMsgStatus(msgRes.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || !form.dueDate) return;
    try {
      setSaving(true);
      await api.post('/reminders', {
        title,
        note: form.note.trim() || null,
        dueDate: form.dueDate,
        ...(form.clientId ? { clientId: Number(form.clientId) } : {}),
        ...(form.chequeId ? { chequeId: Number(form.chequeId) } : {}),
      });
      setForm({
        title: '',
        note: '',
        dueDate: new Date().toISOString().split('T')[0],
        clientId: '',
        chequeId: '',
      });
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (r: ReminderRow) => {
    try {
      await api.patch(`/reminders/${r.id}`, { completed: !Number(r.completed || 0) });
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur.');
    }
  };

  const remove = async (r: ReminderRow) => {
    if (!window.confirm('Supprimer ce rappel ?')) return;
    try {
      await api.delete(`/reminders/${r.id}`);
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur.');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const openSend = (r: ReminderRow, channel: 'email' | 'whatsapp') => {
    const cid = r.clientId;
    if (!cid) return;
    const client = clients.find((c) => c.id === cid);
    if (!client) {
      alert('Client introuvable. Rechargez la page ou modifiez le rappel.');
      return;
    }
    if (channel === 'email' && !client.email?.trim()) {
      alert('Ce client n’a pas d’adresse e-mail.');
      return;
    }
    if (channel === 'whatsapp' && !client.phone?.trim()) {
      alert('Ce client n’a pas de numéro de téléphone.');
      return;
    }
    if (channel === 'email' && !msgStatus?.emailConfigured) {
      alert('Aucun envoi e-mail configuré (voir Paramètres).');
      return;
    }
    if (channel === 'whatsapp' && !msgStatus?.whatsappConfigured) {
      alert('WhatsApp n’est pas configuré (voir Paramètres).');
      return;
    }
    setSendKind('facture');
    setSendCustom(buildReminderMessage(r));
    setSendCtx({ reminder: r, channel, client });
  };

  const handleSendToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendCtx) return;
    try {
      setSending(true);
      await api.post(`/clients/${sendCtx.client.id}/send-reminder`, {
        channel: sendCtx.channel,
        kind: sendKind,
        customMessage: sendCustom.trim() || undefined,
      });
      alert('Message envoyé.');
      setSendCtx(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Rappels</h1>
        <p className="mt-1 font-medium text-slate-500">
          Alertes automatiques (chèques, factures) et rappels personnels. La cloche du bandeau compte les éléments à traiter
          dans les 7 prochains jours (y compris en retard).
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <section className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-2 text-slate-800">
              <Bell className="h-6 w-6 text-rose-500" />
              <h2 className="text-lg font-black">Automatique</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <CreditCard className="h-4 w-4" />
                  Chèques entrants — échéance sous 7 jours
                </h3>
                {!system?.upcomingCheques?.length ? (
                  <p className="text-sm font-medium text-slate-500">Aucun chèque en attente dans cette fenêtre.</p>
                ) : (
                  <ul className="space-y-2">
                    {system.upcomingCheques.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm"
                      >
                        <span className="font-bold text-slate-800">{c.chequeNumber}</span>
                        <span className="text-slate-600">{c.clientName || '—'}</span>
                        <span className="font-mono text-emerald-700">
                          {Number(c.amount).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {c.dueDate}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <FileWarning className="h-4 w-4" />
                  Factures impayées — plus de 30 jours
                </h3>
                {!system?.overdueInvoices?.length ? (
                  <p className="text-sm font-medium text-slate-500">Aucune facture en retard selon ce critère.</p>
                ) : (
                  <ul className="space-y-2">
                    {system.overdueInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm"
                      >
                        <span className="font-bold text-slate-800">{inv.invoiceNumber}</span>
                        <span className="text-slate-600">{inv.clientName || '—'}</span>
                        <span className="font-mono font-black text-rose-600">
                          Reste {Number(inv.remaining).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        </span>
                        <span className="text-xs text-slate-500">{inv.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-2 text-slate-800">
              <Calendar className="h-6 w-6 text-violet-600" />
              <h2 className="text-lg font-black">Mes rappels</h2>
            </div>

            <form onSubmit={handleCreate} className="mb-8 grid gap-4 rounded-2xl border border-violet-100 bg-violet-50/30 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Titre</label>
                <input
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Relancer client X"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Date</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Note (optionnel)</label>
                <textarea
                  rows={2}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Client (optionnel)
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                >
                  <option value="">— Aucun —</option>
                  {clients
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Chèque (optionnel)
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={form.chequeId}
                  onChange={(e) => setForm({ ...form, chequeId: e.target.value })}
                >
                  <option value="">— Aucun —</option>
                  {cheques
                    .slice()
                    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {formatChequePickLabel(c)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  Ajouter
                </button>
              </div>
            </form>

            {!list.length ? (
              <p className="text-center text-sm font-medium text-slate-500">Aucun rappel personnel pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((r) => {
                  const overdue = r.dueDate < today && !Number(r.completed || 0);
                  const linkedClient = r.clientId ? clients.find((c) => c.id === r.clientId) : undefined;
                  const linkedCheque = r.chequeId ? cheques.find((c) => c.id === r.chequeId) : undefined;
                  const displayClientName =
                    r.clientName?.trim() || linkedClient?.name || (r.clientId ? 'Client' : '');
                  const hasChequeJoin =
                    Boolean(r.chequeId) &&
                    (r.chequeNumber != null ||
                      r.chequeAmount != null ||
                      Boolean(linkedCheque));
                  const canEmail =
                    Boolean(linkedClient?.email?.trim()) && Boolean(msgStatus?.emailConfigured);
                  const canWa =
                    Boolean(linkedClient?.phone?.trim()) && Boolean(msgStatus?.whatsappConfigured);
                  return (
                    <li
                      key={r.id}
                      className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                        Number(r.completed || 0)
                          ? 'border-slate-100 bg-slate-50/50 opacity-70'
                          : overdue
                            ? 'border-rose-200 bg-rose-50/40'
                            : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{r.title}</span>
                          {overdue ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase text-rose-700">
                              En retard
                            </span>
                          ) : null}
                          {Number(r.completed || 0) ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                              Fait
                            </span>
                          ) : null}
                        </div>
                        {r.note ? <p className="mt-1 text-sm text-slate-600">{r.note}</p> : null}
                        <p className="mt-1 text-xs font-bold text-slate-400">Échéance : {r.dueDate}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Client
                          </label>
                          <select
                            value={r.clientId ?? ''}
                            onChange={async (e) => {
                              const raw = e.target.value;
                              try {
                                await api.patch(`/reminders/${r.id}`, {
                                  clientId: raw === '' ? null : Number(raw),
                                });
                                await loadAll();
                              } catch (err: any) {
                                alert(err?.response?.data?.message || 'Erreur.');
                              }
                            }}
                            className="max-w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-400"
                          >
                            <option value="">— Aucun —</option>
                            {clients
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                              .map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Chèque
                          </label>
                          <select
                            value={r.chequeId ?? ''}
                            onChange={async (e) => {
                              const raw = e.target.value;
                              try {
                                await api.patch(`/reminders/${r.id}`, {
                                  chequeId: raw === '' ? null : Number(raw),
                                });
                                await loadAll();
                              } catch (err: any) {
                                alert(err?.response?.data?.message || 'Erreur.');
                              }
                            }}
                            className="max-w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="">— Aucun —</option>
                            {cheques
                              .slice()
                              .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))
                              .map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {formatChequePickLabel(c)}
                                </option>
                              ))}
                          </select>
                        </div>
                        {r.chequeId && hasChequeJoin ? (
                          <div className="mt-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white px-4 py-3 text-sm shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800/80">
                              Chèque lié
                            </p>
                            <dl className="mt-2 grid gap-1.5 text-xs font-medium text-slate-700 sm:grid-cols-2">
                              <div>
                                <dt className="font-bold text-slate-400">N°</dt>
                                <dd className="font-black text-slate-900">
                                  {r.chequeNumber ?? linkedCheque?.chequeNumber ?? '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Montant</dt>
                                <dd className="font-mono font-black text-emerald-800">
                                  {r.chequeAmount != null || linkedCheque
                                    ? `${Number(r.chequeAmount ?? linkedCheque?.amount ?? 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`
                                    : '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Banque</dt>
                                <dd>{r.chequeBankName ?? linkedCheque?.bankName ?? '—'}</dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Émission</dt>
                                <dd>{r.chequeIssueDate ?? linkedCheque?.issueDate ?? '—'}</dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Échéance chèque</dt>
                                <dd className="font-bold text-amber-900">
                                  {r.chequeDueDate ?? linkedCheque?.dueDate ?? '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Type</dt>
                                <dd>{translateChequeType(r.chequeType ?? linkedCheque?.type)}</dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Statut</dt>
                                <dd>{translateChequeStatus(r.chequeStatus ?? linkedCheque?.status)}</dd>
                              </div>
                              <div>
                                <dt className="font-bold text-slate-400">Client (chèque)</dt>
                                <dd>{r.chequeClientName ?? linkedCheque?.clientName ?? '—'}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="font-bold text-slate-400">Facture</dt>
                                <dd>{r.chequeInvoiceNumber ?? linkedCheque?.invoiceNumber ?? '—'}</dd>
                              </div>
                            </dl>
                          </div>
                        ) : r.chequeId && !hasChequeJoin ? (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            Chèque lié introuvable — rechargez ou retirez le lien.
                          </p>
                        ) : null}
                        {r.clientId && linkedClient ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                              {displayClientName}
                            </span>
                            <button
                              type="button"
                              disabled={!canEmail}
                              onClick={() => openSend(r, 'email')}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title={!linkedClient.email?.trim() ? 'E-mail client manquant' : !msgStatus?.emailConfigured ? 'E-mail non configuré' : 'Envoyer par e-mail'}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              E-mail
                            </button>
                            <button
                              type="button"
                              disabled={!canWa}
                              onClick={() => openSend(r, 'whatsapp')}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                              title={
                                !linkedClient.phone?.trim()
                                  ? 'Téléphone client manquant'
                                  : !msgStatus?.whatsappConfigured
                                    ? 'WhatsApp non configuré'
                                    : 'Envoyer par WhatsApp'
                              }
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </button>
                          </div>
                        ) : r.clientId && !linkedClient ? (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            Client lié introuvable — rechargez ou recréez le rappel.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleDone(r)}
                          className="rounded-xl p-2.5 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600"
                          title={Number(r.completed || 0) ? 'Marquer non fait' : 'Marquer fait'}
                        >
                          {Number(r.completed || 0) ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="rounded-xl p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Supprimer"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {sendCtx ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <div>
                <h2 className="text-xl font-black text-slate-800">Message au client</h2>
                <p className="text-sm font-medium text-slate-500">{sendCtx.client.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {sendCtx.channel === 'email'
                    ? sendCtx.client.email
                    : sendCtx.client.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSendCtx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSendToClient} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Sujet (type de rappel)
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={sendKind}
                  onChange={(e) => setSendKind(e.target.value as typeof sendKind)}
                >
                  <option value="paiement">Paiement</option>
                  <option value="livraison">Livraison</option>
                  <option value="facture">Facture</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Message
                </label>
                <textarea
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={sendCustom}
                  onChange={(e) => setSendCustom(e.target.value)}
                  placeholder="Texte envoyé au client (objet e-mail : type de rappel + société)"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSendCtx(null)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-sm font-black text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Envoi…' : sendCtx.channel === 'email' ? 'Envoyer l’e-mail' : 'Envoyer WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reminders;
